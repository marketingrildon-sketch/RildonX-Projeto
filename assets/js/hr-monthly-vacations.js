(function () {
  'use strict';

  var MODULE_KEY = 'hr-leave-attendance';
  var RECORD_TYPE = 'monthly-vacations';
  var root = null;
  var canManage = false;

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

  function currentMonth() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  function activeEmployees(state) {
    return (state.profiles || []).filter(function (profile) {
      return profile && profile.id != null && profile.active !== false;
    }).map(function (profile) {
      return {
        id: String(profile.id),
        name: profile.displayName || profile.nickname || profile.name || 'Colaborador',
        sector: profile.sector || ''
      };
    }).sort(function (first, second) {
      return first.name.localeCompare(second.name, 'pt-BR');
    });
  }

  function vacationRecord(state, month) {
    return (state.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === MODULE_KEY && !record.archived && record.data &&
        record.data.recordType === RECORD_TYPE && record.data.scheduleManagedVacations === true &&
        record.data.month === month;
    }).sort(function (first, second) {
      return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
    })[0] || null;
  }

  function vacationMap(record) {
    var result = new Map();
    var vacations = record && Array.isArray(record.data.vacations) ? record.data.vacations : [];
    vacations.forEach(function (vacation) {
      if (vacation && vacation.employeeId) result.set(String(vacation.employeeId), vacation);
    });
    return result;
  }

  function render(state, month) {
    if (!root) return;
    var employees = activeEmployees(state);
    var record = vacationRecord(state, month);
    var vacations = vacationMap(record);
    var warning = state.businessCardRecordsLoadError
      ? '<div class="hr-monthly-vacations-warning" role="alert">' +
        escapeHtml(state.businessCardRecordsLoadError) +
        '<p>Os períodos não foram alterados. Corrija a conexão antes de salvar.</p></div>'
      : '';
    var rows = employees.map(function (employee) {
      var vacation = vacations.get(employee.id) || {};
      return '<tr><th scope="row">' + escapeHtml(employee.name) +
        '<small>' + escapeHtml(employee.sector || 'Setor não informado') + '</small></th>' +
        '<td><input type="date" data-vacation-start="' + escapeHtml(employee.id) +
        '" min="' + month + '-01" max="' + month + '-31" value="' +
        escapeHtml(vacation.startDate || '') + '" aria-label="Início das férias de ' +
        escapeHtml(employee.name) + '"' + (!canManage || state.businessCardRecordsLoadError ? ' disabled' : '') + '></td>' +
        '<td><input type="date" data-vacation-end="' + escapeHtml(employee.id) +
        '" min="' + month + '-01" max="' + month + '-31" value="' +
        escapeHtml(vacation.endDate || '') + '" aria-label="Fim das férias de ' +
        escapeHtml(employee.name) + '"' + (!canManage || state.businessCardRecordsLoadError ? ' disabled' : '') + '></td></tr>';
    }).join('');
    root.innerHTML = warning +
      '<section class="hr-monthly-vacations" aria-labelledby="hr-monthly-vacations-title">' +
      '<div class="hr-monthly-vacations-heading"><div><h3 id="hr-monthly-vacations-title">Férias do mês</h3>' +
      '<p>Registre o período de férias de cada pessoa. Essas datas também serão consideradas na Tabela de Folgas de Sábado.</p></div>' +
      '<label><span>Mês</span><input type="month" data-vacation-month value="' + month + '"></label></div>' +
      (employees.length
        ? '<form data-hr-monthly-vacations><div class="hr-monthly-vacations-table-wrap"><table>' +
          '<thead><tr><th>Colaborador</th><th>Início das férias</th><th>Fim das férias</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
          (canManage ? '<div class="hr-monthly-vacations-actions"><button type="submit" class="btn"' +
            (state.businessCardRecordsLoadError ? ' disabled' : '') + '>Salvar férias do mês</button></div>' : '') +
          '</form>'
        : '<p class="hr-monthly-vacations-empty">Nenhum funcionário ativo foi encontrado.</p>') +
      '</section>';
  }

  function save(form) {
    if (!canManage) throw new Error('Somente RH e gestores podem salvar férias.');
    var state = window.RildonXStore.getState();
    if (state.businessCardRecordsLoadError) throw new Error(state.businessCardRecordsLoadError);
    var monthInput = root.querySelector('[data-vacation-month]');
    var month = String(monthInput && monthInput.value || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Selecione um mês válido.');
    var employees = activeEmployees(state);
    var vacations = [];
    employees.forEach(function (employee) {
      var startInput = Array.prototype.find.call(form.querySelectorAll('[data-vacation-start]'), function (input) {
        return input.dataset.vacationStart === employee.id;
      });
      var endInput = Array.prototype.find.call(form.querySelectorAll('[data-vacation-end]'), function (input) {
        return input.dataset.vacationEnd === employee.id;
      });
      var startDate = String(startInput && startInput.value || '');
      var endDate = String(endInput && endInput.value || '');
      if (!startDate && !endDate) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
          startDate > endDate || startDate.slice(0, 7) !== month || endDate.slice(0, 7) !== month) {
        throw new Error('Informe um período de férias válido dentro do mês selecionado para ' + employee.name + '.');
      }
      vacations.push({
        employeeId: employee.id,
        employeeName: employee.name,
        startDate: startDate,
        endDate: endDate
      });
    });
    var existing = vacationRecord(state, month);
    var currentProfile = (state.profiles || []).find(function (profile) {
      return String(profile.id) === String(state.user && state.user.id);
    }) || state.user || {};
    var payload = {
      title: 'Férias do mês - ' + month,
      status: 'Registrado',
      data: {
        recordType: RECORD_TYPE,
        scheduleManagedVacations: true,
        month: month,
        vacations: vacations,
        updatedBy: currentProfile.displayName || currentProfile.nickname || currentProfile.name || 'RH'
      }
    };
    var saved = existing
      ? window.RildonXStore.updateBusinessCardRecord(existing.id, payload)
      : window.RildonXStore.addBusinessCardRecord(Object.assign({
        moduleKey: MODULE_KEY,
        sector: 'rh',
        createdBy: state.user && state.user.id || currentProfile.id
      }, payload));
    if (!saved) throw new Error('O armazenamento não confirmou as férias do mês.');
    if (typeof window.showToast === 'function') window.showToast('Férias do mês salvas.');
  }

  function mount(target, state, managerAccess) {
    if (!target || !window.RildonXStore) {
      throw new Error('O armazenamento compartilhado de férias não está disponível.');
    }
    root = target;
    canManage = Boolean(managerAccess);
    var month = root.querySelector('[data-vacation-month]') &&
      root.querySelector('[data-vacation-month]').value || currentMonth();
    render(state, month);
    if (root.dataset.vacationsBound) return;
    root.dataset.vacationsBound = 'true';
    root.addEventListener('change', function (event) {
      var monthInput = event.target.closest('[data-vacation-month]');
      if (monthInput) render(window.RildonXStore.getState(), monthInput.value);
    });
    root.addEventListener('submit', function (event) {
      var form = event.target.closest('[data-hr-monthly-vacations]');
      if (!form) return;
      event.preventDefault();
      var button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      try {
        save(form);
      } catch (error) {
        console.error('Não foi possível salvar as férias do mês:', error);
        if (typeof window.showToast === 'function') {
          window.showToast(error.message || 'Não foi possível salvar as férias do mês.');
        }
      } finally {
        if (button && button.isConnected) button.disabled = false;
      }
    });
  }

  window.RildonXHRMonthlyVacations = { mount: mount };
})();
