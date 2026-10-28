(function () {
  'use strict';

  var MODULE_KEY = 'sales-time-off';
  var mountedRoot = null;
  var controller = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function monthString(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function parseMonth(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]) - 1;
    if (month < 0 || month > 11) return null;
    return new Date(year, month, 1);
  }

  function getSaturdays(month) {
    var firstDay = parseMonth(month);
    if (!firstDay) return [];
    var date = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
    var result = [];
    while (date.getMonth() === firstDay.getMonth()) {
      if (date.getDay() === 6) {
        result.push(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') +
          '-' + String(date.getDate()).padStart(2, '0'));
      }
      date.setDate(date.getDate() + 1);
    }
    return result;
  }

  function dateLabel(value, options) {
    var parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (part) { return !part; })) return 'Data inválida';
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('pt-BR', options || {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
  }

  function saturdayOrdinal(date, month) {
    var dates = getSaturdays(month);
    return dates.indexOf(date) + 1;
  }

  function activeScheduleEmployees(state) {
    return (state.profiles || []).filter(function (profile) {
      if (!profile || profile.id == null || profile.active === false) return false;
      return true;
    }).map(function (profile) {
      return {
        id: String(profile.id),
        name: profile.displayName || profile.nickname || profile.name || 'Colaborador'
      };
    }).sort(function (first, second) {
      return first.name.localeCompare(second.name, 'pt-BR');
    });
  }

  function recordsFor(state) {
    return (state.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === MODULE_KEY && !record.archived && record.data;
    });
  }

  function recordForMonth(state, month) {
    return recordsFor(state).find(function (record) { return record.data.month === month; }) || null;
  }

  function getExceptions(record) {
    return record && Array.isArray(record.data.exceptions) ? record.data.exceptions : [];
  }

  function exceptionCounts(record, dates) {
    var counts = {};
    dates.forEach(function (date) { counts[date] = 0; });
    getExceptions(record).forEach(function (exception) {
      if (Object.prototype.hasOwnProperty.call(counts, exception.date)) counts[exception.date] += 1;
    });
    return counts;
  }

  function getAssignments(record) {
    var assignments = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    return new Map(assignments.filter(function (assignment) {
      return assignment && assignment.userId != null && Array.isArray(assignment.dates);
    }).map(function (assignment) {
      return [String(assignment.userId), assignment.dates.slice().sort()];
    }));
  }

  function buildHistoryCounts(state, month, datesByUser) {
    var result = new Map();
    recordsFor(state).forEach(function (record) {
      var previousMonth = String(record.data.month || '');
      if (!/^\d{4}-\d{2}$/.test(previousMonth) || previousMonth >= month) return;
      (record.data.assignments || []).forEach(function (assignment) {
        var counts = result.get(String(assignment.userId)) || {};
        (assignment.dates || []).forEach(function (date) {
          var ordinal = saturdayOrdinal(date, previousMonth);
          if (ordinal > 0) counts[ordinal] = (counts[ordinal] || 0) + 1;
        });
        result.set(String(assignment.userId), counts);
      });
    });
    return result;
  }

  function solveDistribution(input) {
    var employees = input.employees;
    var dates = input.dates;
    var preferences = input.preferences;
    var previousAssignments = input.previousAssignments;
    var historyCounts = input.historyCounts;
    var exceptionsByDate = input.exceptionsByDate;
    var requiredSlots = employees.length * 2;

    if (dates.length < 2) {
      return { feasible: false, reason: 'São necessários pelo menos dois sábados no mês para cada pessoa ter duas datas distintas.' };
    }

    var source = 0;
    var employeeOffset = 1;
    var dateOffset = employeeOffset + employees.length;
    var sink = dateOffset + dates.length;
    var graph = Array.from({ length: sink + 1 }, function () { return []; });
    function addEdge(from, to, capacity, cost) {
      var forward = { to: to, rev: graph[to].length, cap: capacity, originalCap: capacity, cost: cost };
      var reverse = { to: from, rev: graph[from].length, cap: 0, originalCap: 0, cost: -cost };
      graph[from].push(forward);
      graph[to].push(reverse);
      return forward;
    }

    var historyMonthCount = recordsFor(input.state).filter(function (record) {
      return String(record.data.month || '') < input.month;
    }).length;
    var fairnessBound = (historyMonthCount + 2) * (requiredSlots + 1) * 10;
    var changeWeight = fairnessBound + 1;
    var preferenceWeight = (requiredSlots + 1) * changeWeight;
    var assignmentEdges = [];

    employees.forEach(function (employee, employeeIndex) {
      var employeeNode = employeeOffset + employeeIndex;
      addEdge(source, employeeNode, 2, 0);
      var preferredDates = preferences.get(employee.id);
      var previousDates = previousAssignments.get(employee.id) || [];
      var employeeHistory = historyCounts.get(employee.id) || {};
      dates.forEach(function (date, dateIndex) {
        var ordinal = dateIndex + 1;
        var missesPreference = preferredDates.indexOf(date) === -1;
        var changesExisting = previousDates.length > 0 && previousDates.indexOf(date) === -1;
        var fairnessCost = (employeeHistory[ordinal] || 0) * 10;
        var cost = (missesPreference ? preferenceWeight : 0) +
          (changesExisting ? changeWeight : 0) + fairnessCost;
        var edge = addEdge(employeeNode, dateOffset + dateIndex, 1, cost);
        assignmentEdges.push({ employeeId: employee.id, date: date, edge: edge });
      });
    });

    dates.forEach(function (date, dateIndex) {
      for (var slot = 0; slot < employees.length; slot += 1) {
        addEdge(dateOffset + dateIndex, sink, 1, slot * (historyMonthCount + 1));
      }
    });

    var flow = 0;
    while (flow < requiredSlots) {
      var distances = Array(graph.length).fill(Infinity);
      var previousNode = Array(graph.length).fill(-1);
      var previousEdge = Array(graph.length).fill(-1);
      var queued = Array(graph.length).fill(false);
      var queue = [source];
      distances[source] = 0;
      queued[source] = true;
      for (var queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        var node = queue[queueIndex];
        queued[node] = false;
        graph[node].forEach(function (edge, edgeIndex) {
          var nextDistance = distances[node] + edge.cost;
          if (edge.cap <= 0 || nextDistance >= distances[edge.to]) return;
          distances[edge.to] = nextDistance;
          previousNode[edge.to] = node;
          previousEdge[edge.to] = edgeIndex;
          if (!queued[edge.to]) {
            queue.push(edge.to);
            queued[edge.to] = true;
          }
        });
      }
      if (previousNode[sink] === -1) {
        return { feasible: false, reason: 'Não foi possível calcular a distribuição das folgas.' };
      }
      var current = sink;
      while (current !== source) {
        var from = previousNode[current];
        var pathEdge = graph[from][previousEdge[current]];
        pathEdge.cap -= 1;
        graph[current][pathEdge.rev].cap += 1;
        current = from;
      }
      flow += 1;
    }

    var assignments = new Map();
    assignmentEdges.forEach(function (entry) {
      if (entry.edge.originalCap === 1 && entry.edge.cap === 0) {
        var assignedDates = assignments.get(entry.employeeId) || [];
        assignedDates.push(entry.date);
        assignments.set(entry.employeeId, assignedDates);
      }
    });
    if (employees.some(function (employee) { return (assignments.get(employee.id) || []).length !== 2; })) {
      return { feasible: false, reason: 'O cálculo não encontrou duas datas distintas para cada pessoa.' };
    }
    assignments.forEach(function (assignedDates) { assignedDates.sort(); });

    var changes = employees.map(function (employee) {
      var previous = previousAssignments.get(employee.id) || [];
      var next = assignments.get(employee.id) || [];
      return {
        userId: employee.id,
        name: employee.name,
        from: previous.slice(),
        to: next.slice(),
        changed: previous.length > 0 && (previous.length !== next.length ||
          previous.some(function (date, index) { return date !== next[index]; }))
      };
    }).filter(function (change) { return change.changed; });
    var preferenceViolations = employees.reduce(function (count, employee) {
      var assigned = assignments.get(employee.id) || [];
      return count + preferences.get(employee.id).filter(function (date) {
        return assigned.indexOf(date) === -1;
      }).length;
    }, 0);
    var loads = {};
    dates.forEach(function (date) { loads[date] = 0; });
    assignments.forEach(function (assignedDates) {
      assignedDates.forEach(function (date) { loads[date] += 1; });
    });

    return {
      feasible: true,
      assignments: employees.map(function (employee) {
        return { userId: employee.id, name: employee.name, dates: assignments.get(employee.id) || [] };
      }),
      changes: changes,
      changeCount: changes.reduce(function (count, change) {
        return count + change.from.filter(function (date) { return change.to.indexOf(date) === -1; }).length;
      }, 0),
      preferenceViolations: preferenceViolations,
      loads: loads,
      exceptionsByDate: exceptionsByDate
    };
  }

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  function escapeError(error, fallback) {
    console.error(fallback, error);
    toast(error && error.message ? error.message : fallback);
  }

  function getCurrentProfile(state) {
    var user = state.user || {};
    return (state.profiles || []).find(function (profile) {
      return String(profile.id) === String(controller.userId || user.id);
    }) || user;
  }

  function currentSchedule(state) {
    return recordForMonth(state, controller.month);
  }

  function previewSnapshot(state, record, employees, dates, preferences) {
    return solveDistribution({
      state: state,
      month: controller.month,
      employees: employees,
      dates: dates,
      preferences: preferences,
      previousAssignments: getAssignments(record),
      historyCounts: buildHistoryCounts(state, controller.month),
      exceptionsByDate: exceptionCounts(record, dates)
    });
  }

  function selectOptions(dates, selected, placeholder) {
    return '<option value="">' + escapeHtml(placeholder) + '</option>' + dates.map(function (date) {
      return '<option value="' + date + '"' + (date === selected ? ' selected' : '') + '>' +
        escapeHtml(dateLabel(date)) + '</option>';
    }).join('');
  }

  function renderAssignments(assignments, changeIds) {
    if (!assignments.length) {
      return '<div class="sales-time-off-empty"><b>Nenhuma escala confirmada para este mês.</b>' +
        '<span>O gestor pode escolher as datas e gerar uma prévia.</span></div>';
    }
    return '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table"><thead><tr>' +
      '<th>Colaborador</th><th>1ª folga</th><th>2ª folga</th><th>Situação</th></tr></thead><tbody>' +
      assignments.map(function (assignment) {
        var changed = changeIds && changeIds.has(String(assignment.userId));
        return '<tr><td>' + escapeHtml(assignment.name) + '</td>' +
          '<td>' + escapeHtml(dateLabel(assignment.dates[0])) + '</td><td>' +
          escapeHtml(dateLabel(assignment.dates[1])) + '</td><td>' +
          (changed ? '<span class="sales-time-off-badge is-changed">Redistribuída</span>' :
            '<span class="sales-time-off-badge">Mantida</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderMonthlyRoster(dates, assignments, hasSchedule) {
    var assignmentsByDate = new Map();
    dates.forEach(function (date) { assignmentsByDate.set(date, []); });
    assignments.forEach(function (assignment) {
      if (!assignment || !Array.isArray(assignment.dates)) return;
      assignment.dates.forEach(function (date) {
        var people = assignmentsByDate.get(date);
        if (people) people.push(assignment.name || 'Colaborador');
      });
    });
    var scheduleStatus = hasSchedule
      ? 'Lista da escala confirmada para este mês.'
      : 'A lista estará disponível quando a escala do mês for confirmada.';
    return '<section class="sales-time-off-section sales-time-off-monthly-roster" aria-labelledby="sales-time-off-roster-title">' +
      '<div class="sales-time-off-section-heading"><div><h3 id="sales-time-off-roster-title">Folgas por sábado</h3>' +
      '<p>' + scheduleStatus + '</p></div><span>' + dates.length + ' sábado(s)</span></div>' +
      '<div class="sales-time-off-saturday-grid">' + dates.map(function (date) {
        var people = (assignmentsByDate.get(date) || []).slice().sort(function (first, second) {
          return first.localeCompare(second, 'pt-BR');
        });
        return '<article class="sales-time-off-saturday-card"><div class="sales-time-off-saturday-heading">' +
          '<h4>' + escapeHtml(dateLabel(date)) + '</h4><span>' + people.length + ' pessoa(s)</span></div>' +
          (people.length
            ? '<ul>' + people.map(function (name) { return '<li>' + escapeHtml(name) + '</li>'; }).join('') + '</ul>'
            : '<p class="sales-time-off-saturday-empty">Ninguém escalado</p>') + '</article>';
      }).join('') + '</div></section>';
  }

  function renderExceptions(exceptions) {
    if (!exceptions.length) return '<p class="sales-time-off-muted">Nenhuma exceção autorizada neste mês.</p>';
    return '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table"><thead><tr>' +
      '<th>Colaborador</th><th>Data</th><th>Tipo</th><th>Justificativa</th><th>Autorizado por</th></tr></thead><tbody>' +
      exceptions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (item) {
        return '<tr><td>' + escapeHtml(item.employeeName) + '</td><td>' + escapeHtml(dateLabel(item.date)) +
          '</td><td>' + escapeHtml(item.type) + '</td><td>' + escapeHtml(item.reason) +
          '</td><td>' + escapeHtml(item.authorizedBy) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderHistory(record) {
    var history = record && Array.isArray(record.data.history) ? record.data.history.slice().reverse() : [];
    if (!history.length) return '<p class="sales-time-off-muted">As confirmações e reajustes aparecerão aqui.</p>';
    return '<ol class="sales-time-off-history">' + history.map(function (entry) {
      var action = entry.action === 'exception_authorized' ? 'Exceção autorizada'
        : entry.action === 'published' ? 'Escala publicada' : 'Escala confirmada';
      var detail = entry.action === 'exception_authorized'
        ? entry.exception.employeeName + ' · ' + dateLabel(entry.exception.date) + ' · ' + entry.exception.type
        : entry.action === 'published'
          ? 'Escala disponibilizada para consulta · ' + (entry.assignmentCount || 0) + ' pessoa(s)'
        : (entry.changeCount || 0) + ' folga(s) reajustada(s), ' + (entry.assignments || []).length + ' pessoa(s) na escala';
      var changes = entry.action === 'confirmed' && Array.isArray(entry.changes) ? entry.changes : [];
      var changesMarkup = changes.length
        ? '<ul>' + changes.map(function (change) {
          return '<li>' + escapeHtml(change.name) + ': ' +
            escapeHtml((change.from || []).map(dateLabel).join(' e ') || 'sem escala anterior') +
            ' → ' + escapeHtml((change.to || []).map(dateLabel).join(' e ')) + '</li>';
        }).join('') + '</ul>'
        : '';
      var actor = entry.publishedBy || entry.confirmedBy || entry.authorizedBy || 'Gestor';
      var happenedAt = entry.confirmedAt || entry.authorizedAt || entry.publishedAt;
      return '<li><b>' + escapeHtml(action) + '</b><span>' + escapeHtml(detail) +
        '</span><small>' + escapeHtml(actor) + ' · ' +
        escapeHtml(happenedAt ? new Date(happenedAt).toLocaleString('pt-BR') : '') +
        '</small>' + changesMarkup + '</li>';
    }).join('') + '</ol>';
  }

  function renderConflict(message) {
    return '<div class="sales-time-off-conflict" role="alert"><b>Não há distribuição válida</b><p>' +
      escapeHtml(message) + '</p>' +
      '<p>A escala atual não foi alterada. Confira as datas e gere uma nova prévia.</p></div>';
  }

  function render() {
    if (!controller || !mountedRoot) return;
    var state = window.RildonXStore ? window.RildonXStore.getState() : {};
    var employees = activeScheduleEmployees(state);
    var dates = getSaturdays(controller.month);
    var record = currentSchedule(state);
    var savedAssignments = getAssignments(record);
    var exceptions = getExceptions(record);
    var storedAssignments = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    var preferences = controller.draft && controller.draft.month === controller.month
      ? controller.draft.preferences
      : new Map(storedAssignments.map(function (assignment) {
        return [String(assignment.userId), (assignment.dates || []).slice()];
      }));
    var assignments = storedAssignments;
    var changeIds = controller.preview && controller.preview.month === controller.month
      ? new Set(controller.preview.result.changes.map(function (change) { return change.userId; }))
      : new Set();
    var historyCount = record && Array.isArray(record.data.history) ? record.data.history.length : 0;
    var managerCanEdit = controller.isManager && !controller.loadError;
    var hasConfirmedAssignments = assignments.length > 0;
    var assignedEmployeeIds = new Set(assignments.map(function (assignment) {
      return String(assignment.userId);
    }));
    var hasCurrentRoster = employees.every(function (employee) {
      return assignedEmployeeIds.has(employee.id);
    });
    var isPublished = record && record.status === 'Publicada' && hasCurrentRoster;
    var publicationOutdated = record && record.status === 'Publicada' && !hasCurrentRoster;

    var employeeRows = employees.map(function (employee) {
      var assigned = preferences.get(employee.id) || savedAssignments.get(employee.id) || [];
      var first = assigned[0] || '';
      var second = assigned[1] || '';
      return '<tr><th scope="row">' + escapeHtml(employee.name) + '</th><td><select data-schedule-preference="' +
        escapeHtml(employee.id) + '" data-slot="0" required' + (!managerCanEdit ? ' disabled' : '') + '>' +
        selectOptions(dates, first, 'Escolher 1ª folga') + '</select></td><td><select data-schedule-preference="' +
        escapeHtml(employee.id) + '" data-slot="1" required' + (!managerCanEdit ? ' disabled' : '') + '>' +
        selectOptions(dates, second, 'Escolher 2ª folga') + '</select></td></tr>';
    }).join('');

    var previewMarkup = '';
    if (controller.preview && controller.preview.month === controller.month) {
      var result = controller.preview.result;
      previewMarkup = '<section class="sales-time-off-preview" aria-live="polite"><div class="sales-time-off-section-heading">' +
        '<div><h3>Prévia da redistribuição</h3><p>Confira a proposta antes de confirmar a escala.</p></div>' +
        '<span>' + result.changeCount + ' alteração(ões)</span></div>' +
        (result.preferenceViolations ? '<p class="sales-time-off-preview-warning">' + result.preferenceViolations +
          ' preferência(s) não puderam ser atendidas pela distribuição mais equilibrada; confira as datas propostas antes de confirmar.</p>' : '') +
        '<div class="sales-time-off-distribution">' + dates.map(function (date) {
          return '<div><b>' + escapeHtml(dateLabel(date)) + '</b><span>' +
            (result.loads[date] || 0) + ' folga(s) planejada(s)</span>' +
            ((result.exceptionsByDate[date] || 0) ? '<small>' + result.exceptionsByDate[date] +
              ' exceção(ões) registrada(s)</small>' : '') + '</div>';
        }).join('') + '</div>' +
        renderAssignments(result.assignments, new Set(result.changes.map(function (change) { return change.userId; }))) +
        (result.changes.length ? '<ul class="sales-time-off-change-list">' + result.changes.map(function (change) {
          return '<li><b>' + escapeHtml(change.name) + '</b><span>' +
            escapeHtml(change.from.map(dateLabel).join(' e ')) + ' → ' +
            escapeHtml(change.to.map(dateLabel).join(' e ')) + '</span></li>';
        }).join('') + '</ul>' : '<p class="sales-time-off-muted">A proposta não altera as datas confirmadas.</p>') +
        '<div class="sales-time-off-form-actions"><button type="button" class="btn secondary" data-schedule-cancel-preview>Descartar prévia</button>' +
        '<button type="button" class="btn" data-schedule-confirm' +
        (!managerCanEdit ? ' disabled' : '') + '>Confirmar e salvar escala</button></div></section>';
    } else if (controller.conflict && controller.conflict.month === controller.month) {
      previewMarkup = renderConflict(controller.conflict.reason);
    }

    var rosterMarkup = employees.length
      ? '<form data-schedule-plan><div class="sales-time-off-section-heading"><div><h3>Preferências de folga</h3>' +
        '<p>Escolha duas datas distintas para cada pessoa. Se houver conflito, o sistema propõe a menor redistribuição possível.</p></div></div>' +
        '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table"><thead><tr><th>Colaborador</th><th>1ª folga desejada</th><th>2ª folga desejada</th></tr></thead>' +
        '<tbody>' + employeeRows + '</tbody></table></div>' +
        '<div class="sales-time-off-form-actions"><button type="submit" class="btn" data-schedule-prepare' +
        (!managerCanEdit || controller.loadError ? ' disabled title="O armazenamento compartilhado não está disponível"' : '') +
        '>Gerar prévia</button></div></form>'
      : '<div class="sales-time-off-empty"><b>Nenhum usuário ativo foi encontrado.</b>' +
        '<span>Verifique se os perfis estão carregados e ativos.</span></div>';

    var exceptionOptions = employees.map(function (employee) {
      return '<option value="' + escapeHtml(employee.id) + '">' + escapeHtml(employee.name) + '</option>';
    }).join('');
    var exceptionForm = managerCanEdit && employees.length
      ? '<form class="sales-time-off-exception-form" data-schedule-exception><label><span>Colaborador</span><select name="employeeId" required>' +
        '<option value="">Selecionar pessoa</option>' + exceptionOptions + '</select></label><label><span>Sábado</span><select name="date" required>' +
        '<option value="">Selecionar data</option>' +
        dates.map(function (date) { return '<option value="' + date + '">' + escapeHtml(dateLabel(date)) + '</option>'; }).join('') +
        '</select></label><label><span>Tipo</span><select name="type"><option>Folga adicional</option><option>Ausência excepcional</option><option>Outra exceção</option></select></label>' +
        '<label class="sales-time-off-exception-reason"><span>Justificativa</span><input name="reason" type="text" maxlength="240" required></label>' +
        '<button type="submit" class="btn secondary">Autorizar exceção</button></form>'
      : '';
    var loadWarning = controller.loadError
      ? '<div class="sales-time-off-conflict" role="alert"><b>Armazenamento compartilhado indisponível</b><p>' +
        escapeHtml(controller.loadError) + '</p><p>Não é possível gravar alterações até que o acesso ao armazenamento seja restabelecido.</p></div>'
      : '';
    var monthRecords = recordsFor(state).filter(function (item) {
      return String(item.data.month || '').match(/^\d{4}-\d{2}$/);
    }).sort(function (first, second) { return second.data.month.localeCompare(first.data.month); });
    var historyOptions = monthRecords.map(function (item) {
      return '<option value="' + escapeHtml(item.data.month) + '"' +
        (item.data.month === controller.month ? ' selected' : '') + '>' + escapeHtml(item.data.month) + '</option>';
    }).join('');

    controller.target.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--sales-time-off" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
      '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="green">↻</div>' +
      '<div><span class="dashboard-library-eyebrow">Comercial · Escala compartilhada</span><h2 id="dashboard-business-title">Escala de Folga</h2>' +
      '<p>Cada usuário deverá possuir duas folgas aos sábados por mês. O gestor define as datas e o sistema sugere um rodízio equilibrado considerando o histórico.</p></div>' +
      '<div class="dashboard-business-header-actions">' +
      (controller.fromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
      '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
      loadWarning + '<div class="sales-time-off-toolbar"><label><span>Mês da escala</span><input type="month" data-schedule-month value="' +
      escapeHtml(controller.month) + '"></label><label><span>Consultar mês confirmado</span><select data-schedule-history-month><option value="">Selecionar mês</option>' +
      historyOptions + '</select></label><div><b>' + employees.length + '</b><small>usuário(s) ativo(s) cadastrado(s)</small></div>' +
      '<div><b>' + (assignments || []).length + '</b><small>folga(s) planejada(s)</small></div></div>' +
      renderMonthlyRoster(dates, assignments, assignments.length > 0) +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Distribuição automática</h3>' +
      '<p>Não há limite fixo de pessoas por sábado. Ao gerar a prévia, o sistema distribui as folgas entre as datas disponíveis de forma equilibrada.</p></div></div></section>' +
      '<section class="sales-time-off-section">' + rosterMarkup + previewMarkup + '</section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Escala confirmada</h3>' +
      '<p>' + (record ? 'Última confirmação: ' + escapeHtml(record.data.updatedBy || 'Gestor') +
        (record.updatedAt ? ' · ' + escapeHtml(new Date(record.updatedAt).toLocaleString('pt-BR')) : '') :
        'As datas passam a valer somente depois da confirmação do gestor.') + '</p></div>' +
      '<div class="sales-time-off-actions">' +
      (isPublished ? '<span class="sales-time-off-published">Publicada' +
        (record.data.publishedAt ? ' · ' + escapeHtml(new Date(record.data.publishedAt).toLocaleString('pt-BR')) : '') +
        '</span>' : (publicationOutdated
          ? '<span class="sales-time-off-publication-outdated">Equipe alterada desde a publicação</span>' : '') +
        (managerCanEdit && hasConfirmedAssignments
          ? '<button type="button" class="btn secondary" data-schedule-publish>' +
            (publicationOutdated ? 'Atualizar publicação' : 'Publicar escala') + '</button>' : '')) +
      '<button type="button" class="btn secondary" data-schedule-export' +
        (!hasConfirmedAssignments ? ' disabled title="Confirme uma escala antes de exportar"' : '') +
        '>Exportar CSV</button><span>' + historyCount + ' registro(s) histórico(s)</span></div></div>' +
      renderAssignments(assignments || [], new Set()) + '</section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Exceções autorizadas</h3>' +
      '<p>As exceções autorizadas são registradas separadamente da distribuição mensal planejada.</p></div></div>' +
      exceptionForm + renderExceptions(exceptions) + '</section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Histórico de reajustes</h3>' +
      '<p>Registro das escalas confirmadas e exceções autorizadas.</p></div></div>' + renderHistory(record) + '</section></div>';
  }

  function readPlanForm(form) {
    var state = window.RildonXStore.getState();
    var employees = activeScheduleEmployees(state);
    var dates = getSaturdays(controller.month);
    var record = currentSchedule(state);
    var preferences = new Map();
    employees.forEach(function (employee) {
      var picks = Array.prototype.slice.call(form.querySelectorAll('[data-schedule-preference="' + employee.id + '"]'))
        .sort(function (first, second) { return Number(first.dataset.slot) - Number(second.dataset.slot); })
        .map(function (select) { return select.value; });
      if (picks.length !== 2 || !picks[0] || !picks[1]) {
        throw new Error('Escolha as duas folgas de ' + employee.name + '.');
      }
      if (picks[0] === picks[1]) {
        throw new Error('As duas folgas de ' + employee.name + ' precisam ser em sábados diferentes.');
      }
      preferences.set(employee.id, picks);
    });
    return {
      state: state,
      employees: employees,
      dates: dates,
      record: record,
      preferences: preferences
    };
  }

  function preparePreview(form) {
    if (!controller.isManager) throw new Error('Somente um gestor pode preparar e confirmar a escala.');
    if (controller.loadError) throw new Error(controller.loadError);
    var details = readPlanForm(form);
    var result = previewSnapshot(details.state, details.record, details.employees, details.dates,
      details.preferences);
    controller.draft = {
      month: controller.month,
      preferences: details.preferences
    };
    if (!result.feasible) {
      controller.preview = null;
      controller.conflict = {
        month: controller.month,
        reason: result.reason
      };
      render();
      return;
    }
    controller.conflict = null;
    controller.preview = {
      month: controller.month,
      result: result,
      baseUpdatedAt: details.record && details.record.updatedAt || '',
      rosterIds: details.employees.map(function (employee) { return employee.id; }).sort()
    };
    render();
  }

  function confirmPreview() {
    if (!controller.isManager || !controller.preview || controller.preview.month !== controller.month) {
      throw new Error('Gere uma prévia válida antes de confirmar.');
    }
    if (controller.loadError) throw new Error(controller.loadError);
    var state = window.RildonXStore.getState();
    var record = currentSchedule(state);
    var employees = activeScheduleEmployees(state);
    var currentUpdatedAt = record && record.updatedAt || '';
    var rosterIds = employees.map(function (employee) { return employee.id; }).sort();
    if (currentUpdatedAt !== controller.preview.baseUpdatedAt ||
        JSON.stringify(rosterIds) !== JSON.stringify(controller.preview.rosterIds)) {
      controller.preview = null;
      controller.conflict = null;
      render();
      throw new Error('A equipe ou a escala foi alterada durante a prévia. Gere uma nova proposta antes de confirmar.');
    }
    var result = controller.preview.result;
    var now = new Date().toISOString();
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var previousData = Object.assign({}, record && record.data || {});
    delete previousData.capacityByDate;
    var history = Array.isArray(previousData.history) ? previousData.history.slice() : [];
    history.push({
      action: 'confirmed',
      confirmedAt: now,
      confirmedBy: actor,
      changeCount: result.changeCount,
      changes: result.changes,
      assignments: result.assignments
    });
    var payload = {
      title: 'Escala de Folga - ' + controller.month,
      status: 'Confirmada',
      data: Object.assign({}, previousData, {
        month: controller.month,
        assignments: result.assignments,
        history: history,
        exceptions: getExceptions(record),
        publishedAt: null,
        publishedBy: '',
        updatedBy: actor,
        confirmedAt: now
      })
    };
    var saved = record
      ? window.RildonXStore.updateBusinessCardRecord(record.id, payload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'comercial',
        createdBy: controller.userId || profile.id
      }, payload));
    if (!saved) throw new Error('O armazenamento não confirmou a escala. Nenhuma confirmação foi exibida.');
    controller.preview = null;
    controller.conflict = null;
    controller.draft = null;
    render();
    toast('Escala de ' + controller.month + ' confirmada e salva.');
  }

  function authorizeException(form) {
    if (!controller.isManager) throw new Error('Somente um gestor pode autorizar exceções.');
    if (controller.loadError) throw new Error(controller.loadError);
    var formData = new FormData(form);
    var state = window.RildonXStore.getState();
    var employees = activeScheduleEmployees(state);
    var employee = employees.find(function (item) { return item.id === String(formData.get('employeeId') || ''); });
    var dates = getSaturdays(controller.month);
    var date = String(formData.get('date') || '');
    var type = String(formData.get('type') || '').trim();
    var reason = String(formData.get('reason') || '').trim();
    if (!employee || dates.indexOf(date) === -1 || !type || !reason) {
      throw new Error('Informe colaborador, sábado, tipo e justificativa válidos.');
    }
    var record = currentSchedule(state);
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var now = new Date().toISOString();
    var exception = {
      id: 'exception-' + now.replace(/[^0-9]/g, '') + '-' + employee.id,
      employeeId: employee.id,
      employeeName: employee.name,
      date: date,
      type: type,
      reason: reason,
      authorizedBy: actor,
      authorizedAt: now
    };
    var previousData = Object.assign({}, record && record.data || {});
    delete previousData.capacityByDate;
    var history = Array.isArray(previousData.history) ? previousData.history.slice() : [];
    history.push({
      action: 'exception_authorized',
      authorizedAt: now,
      authorizedBy: actor,
      exception: exception
    });
    var payload = {
      title: 'Escala de Folga - ' + controller.month,
      status: previousData.assignments && previousData.assignments.length ? 'Confirmada' : 'Em planejamento',
      data: Object.assign({}, previousData, {
        month: controller.month,
        assignments: Array.isArray(previousData.assignments) ? previousData.assignments : [],
        exceptions: getExceptions(record).concat(exception),
        history: history,
        publishedAt: null,
        publishedBy: '',
        updatedBy: actor
      })
    };
    var saved = record
      ? window.RildonXStore.updateBusinessCardRecord(record.id, payload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'comercial',
        createdBy: controller.userId || profile.id
      }, payload));
    if (!saved) throw new Error('O armazenamento não confirmou a exceção.');
    controller.preview = null;
    controller.conflict = null;
    render();
    toast('Exceção autorizada e registrada no histórico.');
  }

  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function exportSchedule() {
    var state = window.RildonXStore.getState();
    var record = currentSchedule(state);
    var assignments = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    if (!assignments.length) throw new Error('Confirme uma escala antes de exportar.');
    var rows = [[
      'Competência', 'Tipo de registro', 'Colaborador', '1ª folga', '2ª folga',
      'Data da exceção', 'Tipo da exceção', 'Justificativa', 'Autorizado por', 'Situação'
    ]];
    assignments.forEach(function (assignment) {
      rows.push([
        controller.month, 'Folga planejada', assignment.name,
        dateLabel(assignment.dates && assignment.dates[0]),
        dateLabel(assignment.dates && assignment.dates[1]),
        '', '', '', '', record.status || 'Confirmada'
      ]);
    });
    getExceptions(record).forEach(function (exception) {
      rows.push([
        controller.month, 'Exceção autorizada', exception.employeeName, '', '',
        dateLabel(exception.date), exception.type, exception.reason, exception.authorizedBy,
        record.status || 'Confirmada'
      ]);
    });
    var csv = '\ufeff' + rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n') + '\r\n';
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'escala-de-folga-' + controller.month + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function publishSchedule() {
    if (!controller.isManager) throw new Error('Somente um gestor pode publicar a escala.');
    if (controller.loadError) throw new Error(controller.loadError);
    var state = window.RildonXStore.getState();
    var record = currentSchedule(state);
    var assignments = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    if (!record || !assignments.length) throw new Error('Confirme a escala antes de publicá-la.');
    var assignedIds = new Set(assignments.map(function (assignment) { return String(assignment.userId); }));
    var missingEmployees = activeScheduleEmployees(state).filter(function (employee) {
      return !assignedIds.has(employee.id);
    });
    if (missingEmployees.length) {
      throw new Error('A escala confirmada não inclui todos os usuários ativos atuais. Gere uma nova prévia antes de publicar.');
    }
    if (record.status === 'Publicada') {
      toast('A escala deste mês já está publicada.');
      return;
    }
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var now = new Date().toISOString();
    var history = Array.isArray(record.data.history) ? record.data.history.slice() : [];
    history.push({
      action: 'published',
      publishedAt: now,
      publishedBy: actor,
      assignmentCount: assignments.length
    });
    var saved = window.RildonXStore.updateBusinessCardRecord(record.id, {
      title: 'Escala de Folga - ' + controller.month,
      status: 'Publicada',
      data: Object.assign({}, record.data, {
        history: history,
        publishedAt: now,
        publishedBy: actor
      })
    });
    if (!saved) throw new Error('O armazenamento não confirmou a publicação da escala.');
    render();
    toast('Escala de ' + controller.month + ' publicada para consulta.');
  }

  function handleSubmit(event) {
    var planForm = event.target.closest('[data-schedule-plan]');
    if (planForm) {
      event.preventDefault();
      var prepareButton = planForm.querySelector('[data-schedule-prepare]');
      if (prepareButton) prepareButton.disabled = true;
      try {
        preparePreview(planForm);
      } catch (error) {
        escapeError(error, 'Não foi possível preparar a prévia da escala.');
      } finally {
        if (prepareButton && prepareButton.isConnected) prepareButton.disabled = false;
      }
      return;
    }
    var exceptionForm = event.target.closest('[data-schedule-exception]');
    if (exceptionForm) {
      event.preventDefault();
      var exceptionButton = exceptionForm.querySelector('[type="submit"]');
      if (exceptionButton) exceptionButton.disabled = true;
      try {
        authorizeException(exceptionForm);
      } catch (error) {
        escapeError(error, 'Não foi possível registrar a exceção.');
      } finally {
        if (exceptionButton && exceptionButton.isConnected) exceptionButton.disabled = false;
      }
    }
  }

  function handleClick(event) {
    if (event.target.closest('[data-schedule-export]')) {
      try {
        exportSchedule();
      } catch (error) {
        escapeError(error, 'Não foi possível exportar a escala.');
      }
      return;
    }
    if (event.target.closest('[data-schedule-publish]')) {
      try {
        publishSchedule();
      } catch (error) {
        escapeError(error, 'Não foi possível publicar a escala.');
      }
      return;
    }
    if (event.target.closest('[data-schedule-confirm]')) {
      try {
        confirmPreview();
      } catch (error) {
        escapeError(error, 'Não foi possível confirmar a escala.');
      }
      return;
    }
    if (event.target.closest('[data-schedule-cancel-preview]')) {
      controller.preview = null;
      controller.conflict = null;
      render();
    }
  }

  function invalidatePreview() {
    controller.preview = null;
    controller.conflict = null;
    if (!controller.target) return;
    var form = controller.target.querySelector('[data-schedule-plan]');
    if (form) {
      var preferenceSlots = new Map();
      Array.prototype.forEach.call(form.querySelectorAll('[data-schedule-preference]'), function (select) {
        var slots = preferenceSlots.get(select.dataset.schedulePreference) || [];
        slots[Number(select.dataset.slot)] = select.value;
        preferenceSlots.set(select.dataset.schedulePreference, slots);
      });
      controller.draft = {
        month: controller.month,
        preferences: preferenceSlots
      };
    }
    var preview = controller.target.querySelector('.sales-time-off-preview');
    var conflict = controller.target.querySelector('.sales-time-off-conflict');
    if (preview) preview.remove();
    if (conflict && conflict.closest('.sales-time-off-section')) conflict.remove();
  }

  function handleChange(event) {
    var monthInput = event.target.closest('[data-schedule-month]');
    if (monthInput) {
      if (!parseMonth(monthInput.value)) {
        toast('Selecione uma competência válida.');
        return;
      }
      controller.month = monthInput.value;
      controller.preview = null;
      controller.conflict = null;
      controller.draft = null;
      render();
      return;
    }
    var historyMonth = event.target.closest('[data-schedule-history-month]');
    if (historyMonth && historyMonth.value) {
      controller.month = historyMonth.value;
      controller.preview = null;
      controller.conflict = null;
      controller.draft = null;
      render();
      return;
    }
    if (event.target.closest('[data-schedule-preference]')) {
      invalidatePreview();
    }
  }

  function mount(root, state, isManager, options) {
    if (!root || !window.RildonXStore) {
      throw new Error('O armazenamento compartilhado do portal não está disponível.');
    }
    if (!controller || mountedRoot !== root) {
      mountedRoot = root;
      controller = {
        isManager: Boolean(isManager),
        userId: '',
        month: monthString(new Date()),
        target: options && options.target || root,
        fromLibrary: Boolean(options && options.fromLibrary),
        loadError: '',
        preview: null,
        conflict: null,
        draft: null
      };
      root.addEventListener('submit', handleSubmit);
      root.addEventListener('click', handleClick);
      root.addEventListener('change', handleChange);
      window.RildonXStore.subscribe(function (nextState) {
        if (!mountedRoot || !mountedRoot.classList.contains('open') ||
            !mountedRoot.querySelector('.dashboard-business-panel--sales-time-off')) return;
        if (controller.preview && controller.preview.month === controller.month) {
          var record = recordForMonth(nextState, controller.month);
          var updatedAt = record && record.updatedAt || '';
          var rosterIds = activeScheduleEmployees(nextState).map(function (employee) {
            return employee.id;
          }).sort();
          if (updatedAt !== controller.preview.baseUpdatedAt ||
              JSON.stringify(rosterIds) !== JSON.stringify(controller.preview.rosterIds)) {
            controller.preview = null;
          }
        }
        render();
      });
    }
    controller.isManager = Boolean(isManager);
    controller.target = options && options.target || root;
    controller.userId = String(options && options.userId || state && state.user && state.user.id || '');
    controller.fromLibrary = Boolean(options && options.fromLibrary);
    controller.loadError = state && state.businessCardRecordsLoadError || '';
    render();
  }

  window.RildonXSalesTimeOff = {
    mount: mount,
    calculatePreview: solveDistribution,
    getSaturdays: getSaturdays
  };
})();
