(function () {
  'use strict';

  var MODULE_KEY = 'sales-time-off';
  var WORK_DUTIES = [
    'Balcão',
    'Televendas',
    'Caixa',
    'Suporte aos setores',
    'Conferência',
    'Expedição',
    'Entrega pelo motoboy',
    'Estoque',
    'Garantia',
    'Supervisão',
    'OMRE — transferência e expedição'
  ];
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
        name: profile.displayName || profile.nickname || profile.name || 'Colaborador',
        avatarUrl: profile.avatarUrl || '',
        sector: profile.sector || '',
        role: profile.role || ''
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
    return recordsFor(state).find(function (record) {
      return record.data.recordType !== 'recurring-preferences' && record.data.month === month;
    }) || null;
  }

  function recurringPreferenceRecord(state) {
    return recordsFor(state).find(function (record) {
      return record.data.recordType === 'recurring-preferences';
    }) || null;
  }

  function recurringPreferences(state) {
    var record = recurringPreferenceRecord(state);
    return record && record.data.preferences && typeof record.data.preferences === 'object'
      ? record.data.preferences : {};
  }

  function employeeGroup(employee) {
    var sector = String(employee.sector || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    var role = String(employee.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/venda|comercial/.test(sector) || /venda|comercial/.test(role)) return 'Vendedores';
    if (/estoque|almoxarifado|motoboy|logistica|expedicao|entrega/.test(sector) ||
        /estoque|almoxarifado|motoboy|logistica|expedicao|entrega/.test(role)) return 'Estoque e motoboy';
    return 'Administrativos';
  }

  function vacationEntries(record) {
    return record && Array.isArray(record.data.vacations) ? record.data.vacations.filter(function (vacation) {
      return vacation && vacation.employeeId && /^\d{4}-\d{2}-\d{2}$/.test(vacation.startDate || '') &&
        /^\d{4}-\d{2}-\d{2}$/.test(vacation.endDate || '') && vacation.startDate <= vacation.endDate;
    }) : [];
  }

  function vacationForEmployee(record, employeeId) {
    return vacationEntries(record).find(function (vacation) {
      return String(vacation.employeeId) === String(employeeId);
    }) || null;
  }

  function isOnVacation(record, employeeId, date) {
    var vacation = vacationForEmployee(record, employeeId);
    return Boolean(vacation && vacation.startDate <= date && vacation.endDate >= date);
  }

  function workAssignmentsForDate(record, date) {
    var byDate = record && record.data.workAssignments;
    var byEmployee = byDate && byDate[date];
    return byEmployee && typeof byEmployee === 'object' ? byEmployee : {};
  }

  function pruneWorkAssignments(workAssignments, assignments, record) {
    var offDatesByEmployee = new Map((assignments || []).map(function (assignment) {
      return [String(assignment.userId), assignment.dates || []];
    }));
    var result = {};
    Object.keys(workAssignments || {}).forEach(function (date) {
      var source = workAssignments[date];
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach(function (employeeId) {
        var duty = source[employeeId];
        var isOnLeave = (offDatesByEmployee.get(String(employeeId)) || []).indexOf(date) !== -1;
        if (!isOnLeave && !isOnVacation(record, employeeId, date) && WORK_DUTIES.indexOf(duty) !== -1) {
          if (!result[date]) result[date] = {};
          result[date][employeeId] = duty;
        }
      });
    });
    return result;
  }

  function applyExceptions(assignments, exceptions) {
    var byUser = new Map(assignments.map(function (assignment) {
      return [String(assignment.userId), {
        userId: String(assignment.userId),
        name: assignment.name,
        avatarUrl: assignment.avatarUrl || '',
        dates: assignment.dates.slice()
      }];
    }));
    (exceptions || []).forEach(function (exception) {
      var source = byUser.get(String(exception.employeeId));
      var date = String(exception.date || '');
      if (!source || !date) return;
      if (exception.type === 'Troca de folga entre funcionários') {
        var recipient = byUser.get(String(exception.otherEmployeeId));
        if (!recipient) return;
        source.dates = source.dates.filter(function (assignedDate) { return assignedDate !== date; });
        if (recipient.dates.indexOf(date) === -1) recipient.dates.push(date);
        return;
      }
      if (source.dates.indexOf(date) === -1) source.dates.push(date);
    });
    byUser.forEach(function (assignment) { assignment.dates.sort(); });
    return Array.from(byUser.values());
  }

  function generateAssignments(state, month, preferences, exceptions) {
    var dates = getSaturdays(month);
    var employees = activeScheduleEmployees(state);
    var hasSavedPreferences = Object.keys(preferences).length > 0;
    var generated = employees.map(function (employee) {
      var ordinals = Array.isArray(preferences[employee.id])
        ? preferences[employee.id].map(Number) : hasSavedPreferences ? [1, 4] : [];
      var assignedDates = [];
      ordinals.slice(0, 2).forEach(function (ordinal) {
        var preferredIndex = Math.max(0, Math.min(dates.length - 1, ordinal - 1));
        var candidates = dates.map(function (date, index) {
          return { date: date, index: index, distance: Math.abs(index - preferredIndex) };
        }).sort(function (first, second) {
          return first.distance - second.distance || second.index - first.index;
        });
        var choice = candidates.find(function (candidate) {
          return assignedDates.indexOf(candidate.date) === -1;
        });
        if (choice) assignedDates.push(choice.date);
      });
      return {
        userId: employee.id,
        name: employee.name,
        avatarUrl: employee.avatarUrl,
        dates: assignedDates.sort()
      };
    }).filter(function (assignment) { return assignment.dates.length; });
    return applyExceptions(generated, exceptions);
  }

  function automaticAssignments(state, month, record) {
    var stored = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    if (stored.length && !record.data.generatedFromPreferencesAt && !recurringPreferenceRecord(state)) return stored;
    return generateAssignments(state, month, recurringPreferences(state), getExceptions(record));
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

  function currentScheduleWithVacations(state) {
    var record = currentSchedule(state);
    var monthlyVacation = (state.businessCardRecords || []).filter(function (item) {
      return item && item.moduleKey === 'hr-leave-attendance' && !item.archived && item.data &&
        item.data.recordType === 'monthly-vacations' &&
        item.data.scheduleManagedVacations === true && item.data.month === controller.month;
    }).sort(function (first, second) {
      return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
    })[0];
    if (!monthlyVacation) return record;
    return Object.assign({}, record || {}, {
      data: Object.assign({}, record && record.data || {}, {
        vacations: vacationEntries(monthlyVacation)
      })
    });
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

  function ordinalOptions(selected, slot) {
    var labels = ['1º sábado de cada mês', '2º sábado de cada mês', '3º sábado de cada mês',
      '4º sábado de cada mês', '5º sábado de cada mês'];
    return '<option value="">Escolher ' + (slot === 0 ? '1ª' : '2ª') + ' preferência</option>' +
      labels.map(function (label, index) {
        var value = index + 1;
        return '<option value="' + value + '"' + (Number(selected) === value ? ' selected' : '') +
          '>' + label + '</option>';
      }).join('');
  }

  function preferencesForEmployee(state, employee, record) {
    var saved = recurringPreferences(state)[employee.id];
    if (Array.isArray(saved) && saved.length === 2) return saved;
    var assignments = record && Array.isArray(record.data.assignments) ? record.data.assignments : [];
    var existing = assignments.find(function (assignment) {
      return String(assignment.userId) === employee.id;
    });
    var ordinals = existing && Array.isArray(existing.dates)
      ? existing.dates.map(function (date) { return saturdayOrdinal(date, controller.month); })
        .filter(function (ordinal) { return ordinal > 0; })
      : [];
    return ordinals.length === 2 ? ordinals : [1, 4];
  }

  function renderMonthlyRoster(dates, assignments, employees, record, hasSchedule) {
    var assignmentsByDate = new Map();
    dates.forEach(function (date) { assignmentsByDate.set(date, []); });
    assignments.forEach(function (assignment) {
      if (!assignment || !Array.isArray(assignment.dates)) return;
      assignment.dates.forEach(function (date) {
        var people = assignmentsByDate.get(date);
        if (people) people.push(assignment);
      });
    });
    var scheduleStatus = hasSchedule
      ? 'Consulte as pessoas escaladas para cada sábado.'
      : 'Salve as preferências recorrentes para gerar a escala deste mês.';
    return '<section class="sales-time-off-section sales-time-off-monthly-roster" aria-labelledby="sales-time-off-roster-title">' +
      '<div class="sales-time-off-section-heading"><div><h3 id="sales-time-off-roster-title">Folgas por sábado</h3>' +
      '<p>' + scheduleStatus + '</p></div><span>' + dates.length + ' sábado(s)</span></div>' +
      '<div class="sales-time-off-saturday-grid">' + dates.map(function (date) {
        var people = (assignmentsByDate.get(date) || []).slice().sort(function (first, second) {
          return String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR');
        });
        var groupedPeople = ['Administrativos', 'Vendedores', 'Estoque e motoboy'].map(function (group) {
          var groupPeople = people.filter(function (person) {
            var employee = employees.find(function (item) { return item.id === String(person.userId); });
            return employee && employeeGroup(employee) === group;
          });
          return groupPeople.length
            ? '<li class="sales-time-off-roster-group"><b>' + escapeHtml(group) + '</b><ul>' +
              groupPeople.map(function (person) {
                var initials = String(person.name || 'Colaborador').trim().split(/\s+/).slice(0, 2)
                  .map(function (part) { return part.charAt(0); }).join('').toLocaleUpperCase('pt-BR');
                var employee = employees.find(function (item) { return item.id === String(person.userId); });
                var avatarUrl = employee && employee.avatarUrl || person.avatarUrl;
                var avatar = avatarUrl
                  ? '<img src="' + escapeHtml(avatarUrl) + '" alt="" loading="lazy">'
                  : '<span aria-hidden="true">' + escapeHtml(initials) + '</span>';
                return '<li><span class="sales-time-off-person-avatar">' + avatar + '</span><span class="sales-time-off-person-detail">' +
                  '<b>' + escapeHtml(person.name || 'Colaborador') + '</b><small>Folga neste sábado</small></span></li>';
              }).join('') + '</ul></li>'
            : '';
        }).join('');
        var vacationing = employees.filter(function (employee) {
          return isOnVacation(record, employee.id, date);
        });
        var vacationMarkup = vacationing.length
          ? '<li class="sales-time-off-roster-group"><b>Férias</b><ul>' + vacationing.map(function (employee) {
            var vacation = vacationForEmployee(record, employee.id);
            return '<li class="sales-time-off-vacation-name">' + escapeHtml(employee.name) +
              '<small>' + escapeHtml(dateLabel(vacation.startDate)) +
              ' a ' + escapeHtml(dateLabel(vacation.endDate)) + '</small></li>';
          }).join('') + '</ul></li>'
          : '';
        var rosterContent = groupedPeople + vacationMarkup;
        return '<article class="sales-time-off-saturday-card"><div class="sales-time-off-saturday-heading">' +
          '<h4>' + escapeHtml(dateLabel(date)) + '</h4><span>' + people.length + ' folga(s)</span></div>' +
          (rosterContent ? '<ul class="sales-time-off-roster-groups">' + rosterContent + '</ul>'
            : '<p class="sales-time-off-saturday-empty">Nenhuma folga ou férias registradas</p>') + '</article>';
      }).join('') + '</div></section>';
  }

  function groupedEmployees(employees) {
    return ['Administrativos', 'Vendedores', 'Estoque e motoboy'].map(function (group) {
      return {
        name: group,
        employees: employees.filter(function (employee) { return employeeGroup(employee) === group; })
      };
    }).filter(function (group) { return group.employees.length; });
  }

  function renderGroupTabs(context, groups, renderPanel) {
    if (!groups.length) return '<p class="sales-time-off-muted">Nenhum colaborador neste grupo.</p>';
    var activeGroup = controller.activeTabs[context];
    if (!groups.some(function (group) { return group.name === activeGroup; })) {
      activeGroup = groups[0].name;
    }
    var tabs = groups.map(function (group, index) {
      var tabId = 'sales-time-off-' + context + '-tab-' + index;
      var panelId = 'sales-time-off-' + context + '-panel-' + index;
      var selected = group.name === activeGroup;
      return '<button type="button" class="sales-time-off-tab" role="tab" id="' + tabId +
        '" aria-controls="' + panelId + '" aria-selected="' + selected + '" tabindex="' +
        (selected ? '0' : '-1') + '" data-time-off-tab="' + escapeHtml(group.name) + '">' +
        '<span>' + escapeHtml(group.name) + '</span><small>' + group.employees.length + '</small></button>';
    }).join('');
    var panels = groups.map(function (group, index) {
      var tabId = 'sales-time-off-' + context + '-tab-' + index;
      var panelId = 'sales-time-off-' + context + '-panel-' + index;
      return '<div class="sales-time-off-tab-panel" role="tabpanel" id="' + panelId +
        '" aria-labelledby="' + tabId + '" tabindex="0"' +
        (group.name !== activeGroup ? ' hidden' : '') + '>' +
        renderPanel(group) + '</div>';
    }).join('');
    return '<div class="sales-time-off-tabs" data-time-off-tabs="' + context + '">' +
      '<div class="sales-time-off-tab-list" role="tablist" aria-label="' +
      (context === 'preferences' ? 'Grupos de preferências de folga' : 'Grupos da distribuição de trabalho') +
      '">' + tabs + '</div>' + panels + '</div>';
  }

  function renderPreferenceTabs(employees, preferences, managerCanEdit) {
    var groups = groupedEmployees(employees);
    return renderGroupTabs('preferences', groups, function (group) {
      var rows = group.employees.map(function (employee) {
        var assigned = preferences.get(employee.id) || [1, 4];
        var first = assigned[0] || '';
        var second = assigned[1] || '';
        return '<tr><th scope="row">' + escapeHtml(employee.name) + '</th><td><select data-schedule-preference="' +
          escapeHtml(employee.id) + '" data-slot="0" required' + (!managerCanEdit ? ' disabled' : '') + '>' +
          ordinalOptions(first, 0) + '</select></td><td><select data-schedule-preference="' +
          escapeHtml(employee.id) + '" data-slot="1" required' + (!managerCanEdit ? ' disabled' : '') + '>' +
          ordinalOptions(second, 1) + '</select></td></tr>';
      }).join('');
      return '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table"><thead><tr>' +
        '<th>Colaborador</th><th>1ª preferência</th><th>2ª preferência</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    });
  }

  function renderWorkAssignments(dates, employees, assignments, record, managerCanEdit) {
    if (!employees.length) return '<p class="sales-time-off-muted">Nenhum colaborador ativo para distribuir.</p>';
    var offDatesByEmployee = new Map(assignments.map(function (assignment) {
      return [String(assignment.userId), assignment.dates || []];
    }));
    return renderGroupTabs('work', groupedEmployees(employees), function (group) {
      var rows = group.employees.map(function (employee) {
        var cells = dates.map(function (date) {
          var value = workAssignmentsForDate(record, date)[employee.id] || '';
          var onVacation = isOnVacation(record, employee.id, date);
          var onLeave = (offDatesByEmployee.get(employee.id) || []).indexOf(date) !== -1;
          if (onVacation || onLeave) {
            return '<td><select aria-label="' + escapeHtml(employee.name + ' · ' + dateLabel(date) + ' · ' +
              (onVacation ? 'Férias' : 'Folga')) + '" data-work-assignment data-employee="' +
              escapeHtml(employee.id) + '" data-date="' + date + '" disabled>' +
              '<option value="" selected>' + (onVacation ? 'Férias' : 'Folga') + '</option>' +
              WORK_DUTIES.map(function (duty) {
                return '<option value="' + escapeHtml(duty) + '" disabled>' + escapeHtml(duty) + '</option>';
              }).join('') + '</select></td>';
          }
          return '<td><select aria-label="' + escapeHtml(employee.name + ' · ' + dateLabel(date)) +
            '" data-work-assignment data-employee="' + escapeHtml(employee.id) + '" data-date="' + date +
            '"' + (!managerCanEdit ? ' disabled' : '') + '><option value="">Não definido</option>' +
            WORK_DUTIES.map(function (duty) {
              return '<option value="' + escapeHtml(duty) + '"' + (value === duty ? ' selected' : '') + '>' +
                escapeHtml(duty) + '</option>';
            }).join('') + '</select></td>';
        }).join('');
        return '<tr><th scope="row">' + escapeHtml(employee.name) +
          '<small class="sales-time-off-sector">' + escapeHtml(employee.sector || 'Setor não informado') +
          '</small></th><td><span class="sales-time-off-badge">' + escapeHtml(employeeGroup(employee)) +
          '</span></td>' + cells + '</tr>';
      }).join('');
      return '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table sales-time-off-work-table"><thead><tr>' +
        '<th>Colaborador</th><th>Grupo</th>' + dates.map(function (date) {
          return '<th>' + escapeHtml(dateLabel(date, { day: '2-digit', month: '2-digit' })) + '</th>';
        }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    });
  }

  function renderExceptions(exceptions) {
    if (!exceptions.length) return '<p class="sales-time-off-muted">Nenhuma exceção autorizada neste mês.</p>';
    return '<div class="sales-time-off-table-wrap"><table class="sales-time-off-table"><thead><tr>' +
      '<th>Colaborador</th><th>Data</th><th>Tipo</th><th>Justificativa</th><th>Autorizado por</th></tr></thead><tbody>' +
      exceptions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (item) {
        return '<tr><td>' + escapeHtml(item.employeeName) +
          (item.otherEmployeeName ? ' ↔ ' + escapeHtml(item.otherEmployeeName) : '') +
          '</td><td>' + escapeHtml(dateLabel(item.date)) +
          '</td><td>' + escapeHtml(item.type) + '</td><td>' + escapeHtml(item.reason) +
          '</td><td>' + escapeHtml(item.authorizedBy) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderHistory(record) {
    var history = record && Array.isArray(record.data.history) ? record.data.history.slice().reverse() : [];
    if (!history.length) return '<p class="sales-time-off-muted">As preferências e exceções autorizadas aparecerão aqui.</p>';
    return '<ol class="sales-time-off-history">' + history.map(function (entry) {
      var action = entry.action === 'exception_authorized' ? 'Exceção autorizada'
        : entry.action === 'preferences_saved' ? 'Preferências recorrentes salvas'
          : entry.action === 'vacations_saved' ? 'Férias atualizadas'
            : entry.action === 'work_assignments_saved' ? 'Distribuição de trabalho atualizada'
              : entry.action === 'published' ? 'Escala publicada' : 'Escala confirmada';
      var detail = entry.action === 'exception_authorized'
        ? entry.exception.employeeName + (entry.exception.otherEmployeeName
          ? ' ↔ ' + entry.exception.otherEmployeeName : '') + ' · ' +
          dateLabel(entry.exception.date) + ' · ' + entry.exception.type
        : entry.action === 'preferences_saved'
          ? 'Preferências atualizadas para ' + (entry.employeeCount || 0) + ' pessoa(s)'
        : entry.action === 'vacations_saved'
          ? 'Períodos de férias registrados para o mês'
        : entry.action === 'work_assignments_saved'
          ? 'Responsabilidades de trabalho registradas para os sábados do mês'
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

  function render() {
    if (!controller || !mountedRoot) return;
    var state = window.RildonXStore ? window.RildonXStore.getState() : {};
    var employees = activeScheduleEmployees(state);
    var dates = getSaturdays(controller.month);
    var record = currentScheduleWithVacations(state);
    var exceptions = getExceptions(record);
    var assignments = automaticAssignments(state, controller.month, record);
    var recurringRecord = recurringPreferenceRecord(state);
    var preferences = controller.draft && controller.draft.preferences ||
      new Map(employees.map(function (employee) {
        return [employee.id, preferencesForEmployee(state, employee, record)];
      }));
    var historyRecord = record && record.data.history && record.data.history.length ? record : recurringRecord;
    var historyCount = historyRecord && Array.isArray(historyRecord.data.history) ? historyRecord.data.history.length : 0;
    var plannedTimeOffCount = assignments.reduce(function (count, assignment) {
      return count + (Array.isArray(assignment.dates) ? assignment.dates.length : 0);
    }, 0);
    var vacationCount = vacationEntries(record).length;
    var workAssignmentCount = dates.reduce(function (count, date) {
      return count + Object.keys(workAssignmentsForDate(record, date)).length;
    }, 0);
    var pendingWorkAssignmentCount = dates.reduce(function (count, date) {
      var assigned = workAssignmentsForDate(record, date);
      return count + employees.filter(function (employee) {
        var off = assignments.some(function (assignment) {
          return String(assignment.userId) === employee.id && assignment.dates.indexOf(date) !== -1;
        });
        return !off && !isOnVacation(record, employee.id, date) && !assigned[employee.id];
      }).length;
    }, 0);
    var hasScheduleData = assignments.length > 0 || vacationCount > 0 || workAssignmentCount > 0 || exceptions.length > 0;
    var managerCanEdit = controller.isManager && !controller.loadError;

    var rosterMarkup = employees.length
      ? '<form data-schedule-plan><div class="sales-time-off-section-heading"><div><h3>Preferências de folga</h3>' +
        '<p>Escolha duas posições de sábado que se repetem para cada pessoa em todos os meses.</p></div></div>' +
        renderPreferenceTabs(employees, preferences, managerCanEdit) +
        '<div class="sales-time-off-form-actions"><button type="submit" class="btn" data-schedule-save' +
        (!managerCanEdit || controller.loadError ? ' disabled title="O armazenamento compartilhado não está disponível"' : '') +
        '>Salvar</button><button type="button" class="btn secondary" data-schedule-export' +
        (!hasScheduleData ? ' disabled title="Registre dados na escala para habilitar a exportação"' : '') +
        '>Exportar escala</button></div></form>'
      : '<div class="sales-time-off-empty"><b>Nenhum usuário ativo foi encontrado.</b>' +
        '<span>Verifique se os perfis estão carregados e ativos.</span></div>';

    var exceptionOptions = employees.map(function (employee) {
      return '<option value="' + escapeHtml(employee.id) + '">' + escapeHtml(employee.name) + '</option>';
    }).join('');
    var exceptionForm = managerCanEdit && employees.length
      ? '<form class="sales-time-off-exception-form" data-schedule-exception><label><span data-exception-employee-label>Colaborador</span><select name="employeeId" required>' +
        '<option value="">Selecionar pessoa</option>' + exceptionOptions + '</select></label><label><span>Sábado</span><select name="date" required>' +
        '<option value="">Selecionar data</option>' +
        dates.map(function (date) { return '<option value="' + date + '">' + escapeHtml(dateLabel(date)) + '</option>'; }).join('') +
        '</select></label><label><span>Tipo</span><select name="type" data-exception-type><option>Folga adicional</option><option>Ausência excepcional</option>' +
        '<option>Troca de folga entre funcionários</option><option>Outra exceção</option></select></label>' +
        '<label class="sales-time-off-exception-swap" data-exception-swap-fields hidden><span>Quem passa a folgar</span><select name="otherEmployeeId">' +
        '<option value="">Selecionar pessoa</option>' + exceptionOptions + '</select></label>' +
        '<label class="sales-time-off-exception-reason"><span>Justificativa</span><input name="reason" type="text" maxlength="240" required></label>' +
        '<button type="submit" class="btn sales-time-off-authorize-button">Autorizar exceção</button></form>'
      : '';
    var loadWarning = controller.loadError
      ? '<div class="sales-time-off-conflict" role="alert"><b>Armazenamento compartilhado indisponível</b><p>' +
        escapeHtml(controller.loadError) + '</p><p>Não é possível gravar alterações até que o acesso ao armazenamento seja restabelecido.</p></div>'
      : '';
    controller.target.innerHTML = '<div class="dashboard-business-panel dashboard-business-panel--sales-time-off" role="dialog" aria-modal="true" aria-labelledby="dashboard-business-title">' +
      '<div class="dashboard-business-header"><div class="dashboard-business-heading-icon" data-tone="green">↻</div>' +
      '<div><span class="dashboard-library-eyebrow">Comercial · Escala compartilhada</span><h2 id="dashboard-business-title">Tabela de Folgas de Sábado</h2>' +
      '<p>Consulte as folgas por grupo, identifique férias e distribua as equipes e responsabilidades de cada sábado.</p></div>' +
      '<div class="dashboard-business-header-actions">' +
      (controller.fromLibrary ? '<button type="button" class="dashboard-business-back" data-business-library-back>‹ Voltar</button>' : '') +
      '<button type="button" class="dashboard-library-close dashboard-business-exit" data-business-close aria-label="Sair do painel" title="Sair do painel">×</button></div></div>' +
      loadWarning + '<div class="sales-time-off-toolbar"><label><span>Mês da escala</span><input type="month" data-schedule-month value="' +
      escapeHtml(controller.month) + '"></label><div><b>' + employees.length + '</b><small>usuário(s) ativo(s) cadastrado(s)</small></div>' +
      '<div><b>' + plannedTimeOffCount + '</b><small>folga(s) planejada(s)</small></div>' +
      '<div><b>' + vacationCount + '</b><small>colaborador(es) em férias</small></div>' +
      '<div><b>' + workAssignmentCount + '</b><small>responsabilidade(s) distribuída(s)</small></div></div>' +
      renderMonthlyRoster(dates, assignments, employees, record, assignments.length > 0) +
      '<section class="sales-time-off-section">' + rosterMarkup + '</section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Distribuição das equipes por sábado</h3>' +
      '<p>Para cada pessoa que não esteja de folga ou em férias, selecione a responsabilidade de trabalho. O preenchimento é manual: confira nomes, datas e cobertura de cada setor antes do sábado. As células sem atribuição ficam visíveis para conferência.</p></div>' +
      '<span>' + pendingWorkAssignmentCount + ' sem atribuição · ' + workAssignmentCount + ' distribuída(s)</span></div>' +
      '<form data-schedule-work>' + renderWorkAssignments(dates, employees, assignments, record, managerCanEdit) +
      (managerCanEdit ? '<div class="sales-time-off-form-actions"><button type="submit" class="btn" data-work-save>Salvar distribuição</button></div>' : '') +
      '</form></section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Exceções autorizadas</h3>' +
      '<p>Exceções e trocas atualizam automaticamente a lista do sábado selecionado.</p></div></div>' +
      exceptionForm + renderExceptions(exceptions) + '</section>' +
      '<section class="sales-time-off-section"><div class="sales-time-off-section-heading"><div><h3>Histórico de reajustes</h3>' +
      '<p>' + historyCount + ' registro(s) de preferências, férias, atribuições e exceções.</p></div></div>' +
      renderHistory(historyRecord) + '</section></div>';
  }

  function readPreferenceForm(form) {
    var state = window.RildonXStore.getState();
    var employees = activeScheduleEmployees(state);
    var preferences = {};
    employees.forEach(function (employee) {
      var selects = Array.prototype.filter.call(form.querySelectorAll('[data-schedule-preference]'), function (select) {
        return select.dataset.schedulePreference === employee.id;
      });
      var picks = selects
        .sort(function (first, second) { return Number(first.dataset.slot) - Number(second.dataset.slot); })
        .map(function (select) { return Number(select.value); });
      if (picks.length !== 2 || picks.some(function (ordinal) {
        return !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 5;
      })) {
        throw new Error('Escolha as duas preferências de sábado de ' + employee.name + '.');
      }
      if (picks[0] === picks[1]) {
        throw new Error('As duas preferências de ' + employee.name + ' precisam ser diferentes.');
      }
      preferences[employee.id] = picks;
    });
    return {
      state: state,
      employees: employees,
      preferences: preferences
    };
  }

  function savePreferences(form) {
    if (!controller.isManager) throw new Error('Somente um gestor pode salvar as preferências da escala.');
    if (controller.loadError) throw new Error(controller.loadError);
    var details = readPreferenceForm(form);
    if (!details.employees.length) throw new Error('Não há usuários ativos para salvar preferências.');
    var state = window.RildonXStore.getState();
    var record = currentSchedule(state);
    var preferencesRecord = recurringPreferenceRecord(state);
    var now = new Date().toISOString();
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var previousPreferenceData = Object.assign({}, preferencesRecord && preferencesRecord.data || {});
    var preferenceHistory = Array.isArray(previousPreferenceData.history)
      ? previousPreferenceData.history.slice() : [];
    preferenceHistory.push({
      action: 'preferences_saved',
      confirmedAt: now,
      confirmedBy: actor,
      employeeCount: details.employees.length
    });
    var preferencePayload = {
      title: 'Preferências recorrentes - Escala de Folga',
      status: 'Ativa',
      data: Object.assign({}, previousPreferenceData, {
        recordType: 'recurring-preferences',
        preferences: details.preferences,
        history: preferenceHistory,
        updatedBy: actor,
        savedAt: now
      })
    };
    var savedPreferences = preferencesRecord
      ? window.RildonXStore.updateBusinessCardRecord(preferencesRecord.id, preferencePayload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'comercial',
        createdBy: controller.userId || profile.id
      }, preferencePayload));
    if (!savedPreferences) throw new Error('O armazenamento não salvou as preferências recorrentes.');

    state = window.RildonXStore.getState();
    var storedRecord = currentSchedule(state);
    record = currentScheduleWithVacations(state);
    var assignments = generateAssignments(state, controller.month, details.preferences, getExceptions(record));
    var previousData = Object.assign({}, storedRecord && storedRecord.data || {});
    delete previousData.capacityByDate;
    var scheduleHistory = Array.isArray(previousData.history) ? previousData.history.slice() : [];
    scheduleHistory.push({
      action: 'preferences_saved',
      confirmedAt: now,
      confirmedBy: actor,
      employeeCount: details.employees.length
    });
    var payload = {
      title: 'Escala de Folga - ' + controller.month,
      status: 'Automática',
      data: Object.assign({}, previousData, {
        month: controller.month,
        assignments: assignments,
        workAssignments: pruneWorkAssignments(previousData.workAssignments, assignments, record),
        history: scheduleHistory,
        exceptions: getExceptions(record),
        updatedBy: actor,
        generatedAt: now,
        generatedFromPreferencesAt: now
      })
    };
    var savedSchedule = storedRecord
      ? window.RildonXStore.updateBusinessCardRecord(storedRecord.id, payload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'comercial',
        createdBy: controller.userId || profile.id
      }, payload));
    if (!savedSchedule) throw new Error('As preferências foram salvas, mas a lista mensal não foi gravada.');
    controller.draft = null;
    render();
    toast('Preferências salvas. A escala de ' + controller.month + ' foi gerada automaticamente.');
  }

  function readWorkAssignments(form) {
    var state = window.RildonXStore.getState();
    var employees = activeScheduleEmployees(state);
    var employeeIds = new Set(employees.map(function (employee) { return employee.id; }));
    var dates = new Set(getSaturdays(controller.month));
    var record = currentScheduleWithVacations(state);
    var assignmentsByEmployee = new Map(automaticAssignments(state, controller.month, record).map(function (assignment) {
      return [String(assignment.userId), assignment.dates || []];
    }));
    var assignments = {};
    Array.prototype.forEach.call(form.querySelectorAll('[data-work-assignment]'), function (select) {
      var employeeId = String(select.dataset.employee || '');
      var date = String(select.dataset.date || '');
      var duty = String(select.value || '');
      if (!employeeIds.has(employeeId) || !dates.has(date) ||
          duty && WORK_DUTIES.indexOf(duty) === -1) {
        throw new Error('A distribuição contém uma pessoa, data ou responsabilidade inválida.');
      }
      if (duty && ((assignmentsByEmployee.get(employeeId) || []).indexOf(date) !== -1 ||
          isOnVacation(record, employeeId, date))) {
        throw new Error('Não é possível atribuir trabalho a uma pessoa de folga ou férias.');
      }
      if (!duty) return;
      if (!assignments[date]) assignments[date] = {};
      assignments[date][employeeId] = duty;
    });
    return assignments;
  }

  function saveMonthlyPlan(changes, action, successMessage) {
    if (!controller.isManager) throw new Error('Somente um gestor pode atualizar a escala.');
    if (controller.loadError) throw new Error(controller.loadError);
    var state = window.RildonXStore.getState();
    var record = currentSchedule(state);
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var now = new Date().toISOString();
    var previousData = Object.assign({}, record && record.data || {});
    var history = Array.isArray(previousData.history) ? previousData.history.slice() : [];
    history.push({
      action: action,
      confirmedAt: now,
      confirmedBy: actor
    });
    var payload = {
      title: 'Escala de Folga - ' + controller.month,
      status: record && record.status || 'Em planejamento',
      data: Object.assign({}, previousData, changes, {
        month: controller.month,
        history: history,
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
    if (!saved) throw new Error('O armazenamento não confirmou as alterações da escala.');
    render();
    toast(successMessage);
  }

  function saveWorkPlan(form) {
    var assignments = readWorkAssignments(form);
    saveMonthlyPlan({
      workAssignments: assignments
    }, 'work_assignments_saved', 'Distribuição das equipes salva para os sábados do mês.');
  }

  function authorizeException(form) {
    if (!controller.isManager) throw new Error('Somente um gestor pode autorizar exceções.');
    if (controller.loadError) throw new Error(controller.loadError);
    var formData = new FormData(form);
    var state = window.RildonXStore.getState();
    var employees = activeScheduleEmployees(state);
    var employee = employees.find(function (item) { return item.id === String(formData.get('employeeId') || ''); });
    var otherEmployee = employees.find(function (item) {
      return item.id === String(formData.get('otherEmployeeId') || '');
    });
    var dates = getSaturdays(controller.month);
    var date = String(formData.get('date') || '');
    var type = String(formData.get('type') || '').trim();
    var reason = String(formData.get('reason') || '').trim();
    var isSwap = type === 'Troca de folga entre funcionários';
    if (!employee || dates.indexOf(date) === -1 || !type || !reason ||
        isSwap && (!otherEmployee || otherEmployee.id === employee.id)) {
      throw new Error('Informe colaborador, sábado, tipo e justificativa válidos.');
    }
    var storedRecord = currentSchedule(state);
    var record = currentScheduleWithVacations(state);
    var assignments = automaticAssignments(state, controller.month, record).map(function (assignment) {
      return {
        userId: String(assignment.userId),
        name: assignment.name,
        avatarUrl: assignment.avatarUrl || '',
        dates: assignment.dates.slice()
      };
    });
    if (!assignments.length) {
      throw new Error('Salve as preferências recorrentes antes de autorizar exceções.');
    }
    var sourceAssignment = assignments.find(function (assignment) {
      return assignment.userId === employee.id;
    });
    if (!sourceAssignment) {
      sourceAssignment = { userId: employee.id, name: employee.name, avatarUrl: employee.avatarUrl, dates: [] };
      assignments.push(sourceAssignment);
    }
    if (isSwap) {
      var recipientAssignment = assignments.find(function (assignment) {
        return assignment.userId === otherEmployee.id;
      });
      if (!recipientAssignment) {
        recipientAssignment = {
          userId: otherEmployee.id,
          name: otherEmployee.name,
          avatarUrl: otherEmployee.avatarUrl,
          dates: []
        };
        assignments.push(recipientAssignment);
      }
      if (sourceAssignment.dates.indexOf(date) === -1) {
        throw new Error(employee.name + ' não está de folga em ' + dateLabel(date) + '.');
      }
      if (recipientAssignment.dates.indexOf(date) !== -1) {
        throw new Error(otherEmployee.name + ' já está de folga em ' + dateLabel(date) + '.');
      }
      sourceAssignment.dates = sourceAssignment.dates.filter(function (assignedDate) {
        return assignedDate !== date;
      });
      recipientAssignment.dates.push(date);
    } else if (sourceAssignment.dates.indexOf(date) === -1) {
      sourceAssignment.dates.push(date);
    }
    assignments.forEach(function (assignment) { assignment.dates.sort(); });
    var profile = getCurrentProfile(state);
    var actor = profile.displayName || profile.nickname || profile.name || state.user && state.user.name || 'Gestor';
    var now = new Date().toISOString();
    var exception = {
      id: 'exception-' + now.replace(/[^0-9]/g, '') + '-' + employee.id,
      employeeId: employee.id,
      employeeName: employee.name,
      otherEmployeeId: isSwap ? otherEmployee.id : '',
      otherEmployeeName: isSwap ? otherEmployee.name : '',
      date: date,
      type: type,
      reason: reason,
      authorizedBy: actor,
      authorizedAt: now
    };
    var previousData = Object.assign({}, storedRecord && storedRecord.data || {});
    delete previousData.capacityByDate;
    var history = Array.isArray(previousData.history) ? previousData.history.slice() : [];
    history.push({
      action: 'exception_authorized',
      authorizedAt: now,
      authorizedBy: actor,
      exception: exception,
      assignments: assignments
    });
    var payload = {
      title: 'Escala de Folga - ' + controller.month,
      status: 'Automática',
      data: Object.assign({}, previousData, {
        month: controller.month,
        assignments: assignments,
        workAssignments: pruneWorkAssignments(previousData.workAssignments, assignments, record),
        exceptions: getExceptions(record).concat(exception),
        history: history,
        updatedBy: actor
      })
    };
    var saved = storedRecord
      ? window.RildonXStore.updateBusinessCardRecord(storedRecord.id, payload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'comercial',
        createdBy: controller.userId || profile.id
      }, payload));
    if (!saved) throw new Error('O armazenamento não confirmou a exceção.');
    render();
    toast('Exceção autorizada e registrada no histórico.');
  }

  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function exportSchedule() {
    var state = window.RildonXStore.getState();
    var record = currentScheduleWithVacations(state);
    var assignments = automaticAssignments(state, controller.month, record);
    var employees = activeScheduleEmployees(state);
    var vacations = vacationEntries(record);
    var workAssignments = record && record.data.workAssignments || {};
    if (!assignments.length && !vacations.length && !Object.keys(workAssignments).length &&
        !getExceptions(record).length) {
      throw new Error('Não há dados de escala para exportar neste mês.');
    }
    var rows = [[
      'Competência', 'Tipo de registro', 'Grupo', 'Colaborador', 'Data do sábado',
      'Responsabilidade', 'Início das férias', 'Fim das férias', 'Data da exceção',
      'Tipo da exceção', 'Justificativa', 'Autorizado por', 'Situação'
    ]];
    assignments.forEach(function (assignment) {
      var employee = employees.find(function (item) { return item.id === String(assignment.userId); });
      (assignment.dates || []).forEach(function (date) {
        rows.push([controller.month, 'Folga planejada', employee ? employeeGroup(employee) : '',
          assignment.name, dateLabel(date), '', '', '', '', '', '', '', record.status || 'Em planejamento']);
      });
    });
    getSaturdays(controller.month).forEach(function (date) {
      var dayAssignments = workAssignmentsForDate(record, date);
      Object.keys(dayAssignments).forEach(function (employeeId) {
        var employee = employees.find(function (item) { return item.id === employeeId; });
        var offDates = assignments.find(function (item) { return String(item.userId) === employeeId; });
        if (!employee || isOnVacation(record, employeeId, date) ||
            offDates && offDates.dates.indexOf(date) !== -1) return;
        rows.push([controller.month, 'Distribuição de trabalho', employeeGroup(employee),
          employee.name, dateLabel(date), dayAssignments[employeeId], '', '', '', '', '', '',
          record.status || 'Em planejamento']);
      });
    });
    vacations.forEach(function (vacation) {
      var employee = employees.find(function (item) { return item.id === String(vacation.employeeId); });
      rows.push([controller.month, 'Férias', employee ? employeeGroup(employee) : '',
        vacation.employeeName || employee && employee.name || 'Colaborador', '', '',
        dateLabel(vacation.startDate), dateLabel(vacation.endDate), '', '', '', '',
        record.status || 'Em planejamento']);
    });
    getExceptions(record).forEach(function (exception) {
      rows.push([
        controller.month, 'Exceção autorizada', '', exception.employeeName, dateLabel(exception.date),
        '', '', '', dateLabel(exception.date), exception.type, exception.reason, exception.authorizedBy,
        record.status || 'Em planejamento'
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

  function handleSubmit(event) {
    var planForm = event.target.closest('[data-schedule-plan]');
    if (planForm) {
      event.preventDefault();
      var saveButton = planForm.querySelector('[data-schedule-save]');
      if (saveButton) saveButton.disabled = true;
      try {
        savePreferences(planForm);
      } catch (error) {
        escapeError(error, 'Não foi possível salvar as preferências da escala.');
      } finally {
        if (saveButton && saveButton.isConnected) saveButton.disabled = false;
      }
      return;
    }
    var workForm = event.target.closest('[data-schedule-work]');
    if (workForm) {
      event.preventDefault();
      var workButton = workForm.querySelector('[data-work-save]');
      if (workButton) workButton.disabled = true;
      try {
        saveWorkPlan(workForm);
      } catch (error) {
        escapeError(error, 'Não foi possível salvar a distribuição de trabalho.');
      } finally {
        if (workButton && workButton.isConnected) workButton.disabled = false;
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
    var tab = event.target.closest('[data-time-off-tab]');
    if (tab) {
      var tabs = tab.closest('[data-time-off-tabs]');
      if (!tabs) return;
      var selectedGroup = tab.dataset.timeOffTab;
      var context = tabs.dataset.timeOffTabs;
      controller.activeTabs[context] = selectedGroup;
      Array.prototype.forEach.call(tabs.querySelectorAll('[data-time-off-tab]'), function (item) {
        var selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      Array.prototype.forEach.call(tabs.querySelectorAll('[role="tabpanel"]'), function (panel) {
        panel.hidden = panel.getAttribute('aria-labelledby') !== tab.id;
      });
      return;
    }
    if (event.target.closest('[data-schedule-export]')) {
      try {
        exportSchedule();
      } catch (error) {
        escapeError(error, 'Não foi possível exportar a escala.');
      }
      return;
    }
  }

  function handleKeydown(event) {
    var tab = event.target.closest('[data-time-off-tab]');
    if (!tab) return;
    var tabs = Array.prototype.slice.call(tab.closest('[data-time-off-tabs]').querySelectorAll('[data-time-off-tab]'));
    var index = tabs.indexOf(tab);
    var nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? tabs.length - 1 : -1;
    if (nextIndex === -1) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }

  function capturePreferenceDraft() {
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
  }

  function handleChange(event) {
    var monthInput = event.target.closest('[data-schedule-month]');
    if (monthInput) {
      if (!parseMonth(monthInput.value)) {
        toast('Selecione uma competência válida.');
        return;
      }
      controller.month = monthInput.value;
      controller.draft = null;
      render();
      return;
    }
    var preference = event.target.closest('[data-schedule-preference]');
    if (preference) {
      capturePreferenceDraft();
      return;
    }
    var exceptionType = event.target.closest('[data-exception-type]');
    if (exceptionType) {
      var form = exceptionType.closest('[data-schedule-exception]');
      var isSwap = exceptionType.value === 'Troca de folga entre funcionários';
      var swapFields = form && form.querySelector('[data-exception-swap-fields]');
      var employeeLabel = form && form.querySelector('[data-exception-employee-label]');
      if (swapFields) {
        swapFields.hidden = !isSwap;
        swapFields.querySelector('select').required = isSwap;
      }
      if (employeeLabel) employeeLabel.textContent = isSwap ? 'Quem deixa de folgar' : 'Colaborador';
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
        draft: null,
        activeTabs: {}
      };
      root.addEventListener('submit', handleSubmit);
      root.addEventListener('click', handleClick);
      root.addEventListener('keydown', handleKeydown);
      root.addEventListener('change', handleChange);
      window.RildonXStore.subscribe(function (nextState) {
        if (!mountedRoot || !mountedRoot.classList.contains('open') ||
            !mountedRoot.querySelector('.dashboard-business-panel--sales-time-off')) return;
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
