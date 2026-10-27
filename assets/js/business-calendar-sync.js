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
    var id = eventId(user.id, settings.source, settings.recordId, settings.slot);
    var dates = eventDates(settings.date);
    if (dates === null) {
      var removed = await client.from('events').update({ deleted_at: new Date().toISOString() })
        .eq('id', id).eq('owner_id', user.id).select('*').maybeSingle();
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
      visibility: 'private',
      owner_id: user.id,
      all_day: dates.allDay,
      all_day_start_date: dates.startDate,
      all_day_end_date: dates.endDate,
      deleted_at: null,
      created_by: user.id,
      project_id: null
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

  window.RildonXBusinessCalendarSync = { sync: sync, syncMany: syncMany, remove: remove };
})();
