(function () {
  'use strict';

  function eventId(userId, source, recordId, slot) {
    var value = [userId, source, recordId, slot].join('|');
    var hashes = [2166136261, 2246822519, 3266489917, 668265263];
    for (var index = 0; index < value.length; index += 1) {
      var code = value.charCodeAt(index);
      hashes = hashes.map(function (hash, hashIndex) {
        hash ^= code + hashIndex * 37;
        return Math.imul(hash, 16777619) >>> 0;
      });
    }
    var hex = hashes.map(function (hash) { return hash.toString(16).padStart(8, '0'); }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-4' + hex.slice(13, 16) +
      '-a' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
  }

  function eventDates(value) {
    var text = String(value || '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      var parts = text.split('-').map(Number);
      var next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (next.toISOString().slice(0, 10) !== text) {
        throw new Error('A data do evento de calendário não é válida.');
      }
      next.setUTCDate(next.getUTCDate() + 1);
      return {
        startsAt: text + 'T12:00:00.000Z',
        endsAt: null,
        allDay: true,
        startDate: text,
        endDate: next.toISOString().slice(0, 10)
      };
    }
    var date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new Error('A data do evento de calendário não é válida.');
    }
    return { startsAt: date.toISOString(), endsAt: null, allDay: false, startDate: null, endDate: null };
  }

  function updateStore(row) {
    if (!window.RildonXStore) return;
    var state = window.RildonXStore.getState();
    var current = state.events || [];
    var event = {
      id: row.id,
      title: row.title,
      description: row.description || '',
      startsAt: row.starts_at,
      endsAt: row.ends_at || null,
      category: row.category || 'reuniao',
      location: row.location || '',
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      visibility: row.visibility || 'private',
      ownerId: row.owner_id || null,
      allDay: Boolean(row.all_day),
      allDayStartDate: row.all_day_start_date || null,
      allDayEndDate: row.all_day_end_date || null,
      deletedAt: row.deleted_at || null,
      projectId: row.project_id || null
    };
    window.RildonXStore.setState({
      events: [event].concat(current.filter(function (item) { return String(item.id) !== String(event.id); }))
    });
  }

  async function getUser(client) {
    var auth = await client.auth.getUser();
    if (auth.error) throw auth.error;
    if (!auth.data || !auth.data.user) throw new Error('Entre novamente para sincronizar com seu calendário.');
    return auth.data.user;
  }

  async function sync(options) {
    var settings = options || {};
    var client = window.supabaseClient;
    if (!client || !client.from || !client.auth) throw new Error('A integração com o calendário não está disponível.');
    if (!settings.source || !settings.recordId || !settings.slot) {
      throw new Error('Não foi possível identificar o registro a sincronizar com o calendário.');
    }
    var user = await getUser(client);
    var isTeamEvent = settings.visibility === 'team';
    var id = eventId(isTeamEvent ? 'team' : user.id, settings.source, settings.recordId, settings.slot);
    var dates = eventDates(settings.date);
    if (dates === null) {
      var removeQuery = client.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (!isTeamEvent) removeQuery = removeQuery.eq('owner_id', user.id);
      var removed = await removeQuery.select('*').maybeSingle();
      if (removed.error) throw removed.error;
      if (removed.data) updateStore(removed.data);
      return null;
    }
    var payload = {
      id: id,
      title: String(settings.title || 'Compromisso').slice(0, 180),
      description: String(settings.description || '').slice(0, 4000),
      starts_at: dates.startsAt,
      ends_at: dates.endsAt,
      category: String(settings.category || 'reuniao').slice(0, 40),
      location: String(settings.location || '').slice(0, 500),
      visibility: isTeamEvent ? 'team' : 'private',
      owner_id: isTeamEvent ? null : user.id,
      all_day: dates.allDay,
      all_day_start_date: dates.startDate,
      all_day_end_date: dates.endDate,
      deleted_at: null,
      created_by: user.id,
      project_id: settings.projectId || null
    };
    var result = await client.from('events').upsert(payload, { onConflict: 'id' }).select('*').single();
    if (result.error) throw result.error;
    updateStore(result.data);
    return result.data;
  }

  async function remove(eventId) {
    var client = window.supabaseClient;
    if (!client || !client.from || !client.auth) throw new Error('A integração com o calendário não está disponível.');
    if (!eventId) throw new Error('Não foi possível identificar o evento a remover do calendário.');
    await getUser(client);
    var result = await client.from('events').update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId).select('*').maybeSingle();
    if (result.error) throw result.error;
    if (result.data) updateStore(result.data);
    return result.data || null;
  }

  async function syncMany(options, entries) {
    var results = await Promise.all((entries || []).map(function (entry) {
      return sync(Object.assign({}, options || {}, entry));
    }));
    return results;
  }

  function syncProject(project) {
    var record = project || {};
    if (!record.id) return Promise.reject(new Error('Não foi possível identificar o projeto para sincronização.'));
    var title = String(record.name || 'Projeto');
    return syncMany({
      source: 'project',
      recordId: record.id,
      visibility: 'team',
      category: 'projeto',
      projectId: record.id,
      description: String(record.description || '')
    }, [
      { slot: 'start', date: record.startDate, title: 'Início do projeto: ' + title },
      { slot: 'end', date: record.endDate, title: 'Conclusão prevista: ' + title }
    ]);
  }

  function syncTask(task) {
    var record = task || {};
    if (!record.id) return Promise.reject(new Error('Não foi possível identificar a tarefa para sincronização.'));
    var title = String(record.title || 'Tarefa');
    return syncMany({
      source: 'task',
      recordId: record.id,
      visibility: 'team',
      category: 'tarefa',
      projectId: record.projectId || null,
      description: String(record.description || '')
    }, [
      { slot: 'start', date: record.startDate, title: 'Início da tarefa: ' + title },
      { slot: 'due', date: record.dueDate, title: 'Prazo da tarefa: ' + title }
    ]);
  }

  function syncDeletedRecord(source, recordId, slots, category, projectId) {
    if (!recordId) return Promise.resolve([]);
    return syncMany({
      source: source,
      recordId: recordId,
      visibility: 'team',
      category: category,
      projectId: projectId || null
    }, slots.map(function (slot) { return { slot: slot, date: null }; }));
  }

  function watchDatedRecords() {
    var store = window.RildonXStore;
    if (!store || typeof store.subscribe !== 'function') return;
    var previousTasks = new Map((store.getState().tasks || []).map(function (task) {
      return [String(task.id), JSON.stringify([task.startDate || null, task.dueDate || null, task.title, task.projectId])];
    }));
    var previousProjects = new Map((store.getState().projects || []).map(function (project) {
      return [String(project.id), JSON.stringify([project.startDate || null, project.endDate || null, project.name])];
    }));
    var pending = new Map();
    var flushTimer = null;

    function enqueue(key, operation) {
      pending.set(key, operation);
      if (flushTimer !== null) return;
      flushTimer = window.setTimeout(function () {
        flushTimer = null;
        var operations = Array.from(pending.values());
        pending.clear();
        operations.reduce(function (chain, run) {
          return chain.then(function () { return run(); });
        }, Promise.resolve()).catch(function (error) {
          console.error('Não foi possível sincronizar as datas de tarefas e projetos com o calendário:', error);
          if (typeof window.showToast === 'function') {
            window.showToast('As datas foram salvas, mas não foi possível sincronizá-las com o calendário.');
          }
        });
      }, 250);
    }

    store.subscribe(function (nextState) {
      var tasks = nextState.tasks || [];
      var projects = nextState.projects || [];
      var currentTaskIds = new Set();
      tasks.forEach(function (task) {
        var id = String(task.id);
        currentTaskIds.add(id);
        var fingerprint = JSON.stringify([task.startDate || null, task.dueDate || null, task.title, task.projectId]);
        if (previousTasks.get(id) === fingerprint) return;
        previousTasks.set(id, fingerprint);
        enqueue('task:' + id, function () { return syncTask(task); });
      });
      previousTasks.forEach(function (_fingerprint, id) {
        if (currentTaskIds.has(id)) return;
        previousTasks.delete(id);
        enqueue('task:' + id, function () {
          return syncDeletedRecord('task', id, ['start', 'due'], 'tarefa');
        });
      });

      var currentProjectIds = new Set();
      projects.forEach(function (project) {
        var id = String(project.id);
        currentProjectIds.add(id);
        var fingerprint = JSON.stringify([project.startDate || null, project.endDate || null, project.name]);
        if (previousProjects.get(id) === fingerprint) return;
        previousProjects.set(id, fingerprint);
        enqueue('project:' + id, function () { return syncProject(project); });
      });
      previousProjects.forEach(function (_fingerprint, id) {
        if (currentProjectIds.has(id)) return;
        previousProjects.delete(id);
        enqueue('project:' + id, function () {
          return syncDeletedRecord('project', id, ['start', 'end'], 'projeto', id);
        });
      });
    });
  }

  watchDatedRecords();
  window.RildonXBusinessCalendarSync = {
    sync: sync,
    syncMany: syncMany,
    syncProject: syncProject,
    syncTask: syncTask,
    remove: remove
  };
})();
