(function () {
  'use strict';

  var MODULE_KEY = 'sales-commercial-management';
  var activeTab = 'overview';
  var selectedMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  var selectedSeller = '';
  var warrantyQuery = '';
  var warrantiesPromise = null;
  var editingRecordId = '';
  var newRecordType = '';
  var formError = '';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function currentProfile(state, userId) {
    return (state.profiles || []).find(function (profile) {
      return String(profile.id) === String(userId);
    }) || state.user || {};
  }

  function personName(profile) {
    return profile.displayName || profile.nickname || profile.name || 'Vendedor';
  }

  function commercialEmployees(state) {
    return (state.profiles || []).filter(function (profile) {
      var sector = String(profile.sector || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return profile && profile.id != null && profile.active !== false &&
        (sector.indexOf('comercial') === 0 || sector.indexOf('vendas') === 0);
    }).sort(function (first, second) {
      return personName(first).localeCompare(personName(second), 'pt-BR');
    });
  }

  function moduleRecords(state) {
    return (state.businessCardRecords || []).filter(function (record) {
      return record && record.moduleKey === MODULE_KEY && !record.archived && record.data;
    });
  }

  function recordMonth(record) {
    return String(record.data.month || record.data.date || '').slice(0, 7);
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function dateLabel(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? match[3] + '/' + match[2] + '/' + match[1] : '—';
  }

  function todayString() {
    var today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') +
      '-' + String(today.getDate()).padStart(2, '0');
  }

  function filteredRecords(state, options) {
    var records = moduleRecords(state).filter(function (record) {
      return recordMonth(record) === selectedMonth;
    });
    if (!options.isManager) {
      records = records.filter(function (record) {
        return String(record.data.sellerId || record.createdBy) === String(options.userId);
      });
    } else if (selectedSeller) {
      records = records.filter(function (record) {
        return String(record.data.sellerId || record.createdBy) === selectedSeller;
      });
    }
    return records;
  }

  function sellerLabel(state, id) {
    var profile = (state.profiles || []).find(function (item) { return String(item.id) === String(id); });
    return profile ? personName(profile) : 'Vendedor';
  }

  function loadWarranties() {
    if (!warrantiesPromise) {
      warrantiesPromise = fetch(new URL('data/sales-manufacturer-warranties.json', document.baseURI))
        .then(function (response) {
          if (!response.ok) throw new Error('Não foi possível carregar os prazos de garantia.');
          return response.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('A lista de garantias possui um formato inválido.');
          return rows;
        })
        .catch(function (error) {
          warrantiesPromise = null;
          throw error;
        });
    }
    return warrantiesPromise;
  }

  function managerSellerSelect(state, selectedId, required) {
    var employees = commercialEmployees(state);
    return '<label>Vendedor<select name="sellerId"' + (required ? ' required' : '') + '>' +
      '<option value="">Selecione</option>' + employees.map(function (profile) {
        var id = String(profile.id);
        return '<option value="' + escapeHtml(id) + '"' + (id === String(selectedId || '') ? ' selected' : '') + '>' +
          escapeHtml(personName(profile)) + '</option>';
      }).join('') + '</select></label>';
  }

  function renderTabs() {
    var tabs = [
      ['overview', 'Visão geral'],
      ['attendance', 'Meus atendimentos'],
      ['sales', 'Vendas realizadas'],
      ['lost', 'Vendas perdidas'],
      ['warranties', 'Garantias']
    ];
    return '<nav class="sales-commercial-tabs" aria-label="Seções da Gestão Comercial">' +
      tabs.map(function (tab) {
        return '<button type="button" data-sales-tab="' + tab[0] + '"' +
          (activeTab === tab[0] ? ' aria-current="page"' : '') + '>' + tab[1] + '</button>';
      }).join('') + '</nav>';
  }

  function renderFilters(state, options) {
    return '<form class="sales-commercial-filters" data-sales-filter-form><label>Mês' +
      '<input type="month" name="month" value="' + escapeHtml(selectedMonth) + '"></label>' +
      (options.isManager ? managerSellerSelect(state, selectedSeller, false).replace('name="sellerId"', 'name="filterSeller"') : '') +
      '<button type="submit">Aplicar</button></form>';
  }

  function renderOverview(state, options) {
    var records = filteredRecords(state, options);
    var goalRecords = records.filter(function (record) { return record.data.recordType === 'goal'; });
    var sales = records.filter(function (record) { return record.data.recordType === 'sale'; });
    var lost = records.filter(function (record) { return record.data.recordType === 'lost'; });
    var attendances = records.filter(function (record) { return record.data.recordType === 'attendance'; });
    var goal = goalRecords.reduce(function (sum, record) { return sum + Number(record.data.goalAmount || 0); }, 0);
    var totalSales = sales.reduce(function (sum, record) { return sum + Number(record.data.amount || 0); }, 0);
    var targetPercent = goal > 0 ? Math.min(100, totalSales / goal * 100) : 0;
    var commercialSummaries = commercialEmployees(state).map(function (profile) {
      var sellerId = String(profile.id);
      var sellerGoals = goalRecords.filter(function (record) {
        return String(record.data.sellerId) === sellerId;
      });
      var sellerSales = sales.filter(function (record) {
        return String(record.data.sellerId) === sellerId;
      });
      var sellerLost = lost.filter(function (record) {
        return String(record.data.sellerId) === sellerId;
      });
      var sellerAttendances = attendances.filter(function (record) {
        return String(record.data.sellerId) === sellerId;
      });
      var sellerGoal = sellerGoals.reduce(function (sum, record) {
        return sum + Number(record.data.goalAmount || 0);
      }, 0);
      var sellerTotal = sellerSales.reduce(function (sum, record) {
        return sum + Number(record.data.amount || 0);
      }, 0);
      return {
        name: personName(profile),
        goal: sellerGoal,
        total: sellerTotal,
        percentage: sellerGoal > 0 ? Math.min(100, sellerTotal / sellerGoal * 100) : 0,
        salesCount: sellerSales.length,
        lostCount: sellerLost.length,
        attendanceCount: sellerAttendances.length
      };
    });
    var goalCards = options.isManager
      ? '<button type="button" class="sales-commercial-primary" data-sales-new-goal>Definir meta</button>'
      : '';
    return '<section class="sales-commercial-metrics" aria-label="Indicadores do mês">' +
      '<article><span>Meta do mês</span><strong>' + money(goal) + '</strong></article>' +
      '<article><span>Vendas realizadas</span><strong>' + money(totalSales) + '</strong></article>' +
      '<article><span>Atendimentos</span><strong>' + attendances.length + '</strong></article>' +
      '<article><span>Vendas fechadas</span><strong>' + sales.length + '</strong></article>' +
      '<article><span>Vendas perdidas</span><strong>' + lost.length + '</strong></article></section>' +
      '<section class="sales-commercial-progress"><div><b>Progresso da meta</b><span>' +
      (goal > 0 ? targetPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : 'Meta não definida') +
      '</span></div><progress max="100" value="' + targetPercent + '"></progress></section>' +
      '<div class="sales-commercial-toolbar"><h3>Resumo de ' + escapeHtml(selectedMonth) + '</h3>' + goalCards + '</div>' +
      (newRecordType === 'goal' ? recordForm(state, options, null, 'goal') : '') +
      (options.isManager && !commercialEmployees(state).length
        ? '<p class="sales-commercial-note">Nenhum perfil ativo do setor Comercial/Vendas foi encontrado para associar metas.</p>' : '') +
      (options.isManager
        ? '<div class="sales-commercial-goals"><h3>Desempenho por vendedor</h3>' +
          '<div class="sales-commercial-table-wrap"><table class="sales-commercial-table"><thead><tr>' +
          '<th>Vendedor</th><th>Meta</th><th>Realizado</th><th>Atingimento</th><th>Atendimentos</th><th>Vendas</th><th>Perdidas</th>' +
          '</tr></thead><tbody>' + commercialSummaries.map(function (summary) {
            return '<tr><td>' + escapeHtml(summary.name) + '</td><td>' + money(summary.goal) + '</td><td>' +
              money(summary.total) + '</td><td>' + (summary.goal > 0
                ? summary.percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—') +
              '</td><td>' + summary.attendanceCount +
              '</td><td>' + summary.salesCount + '</td><td>' + summary.lostCount + '</td></tr>';
          }).join('') + '</tbody></table></div></div>'
        : goalRecords.length ? '<div class="sales-commercial-goals"><h3>Minha meta</h3>' +
          goalRecords.map(function (record) {
            return '<div><span>' + escapeHtml(sellerLabel(state, record.data.sellerId)) + '</span><b>' +
              money(record.data.goalAmount) + '</b></div>';
          }).join('') + '</div>' : '');
  }

  function recordForm(state, options, record, recordType) {
    var data = record && record.data || {};
    var isGoal = recordType === 'goal';
    var isAttendance = recordType === 'attendance';
    var typeLabel = isGoal ? 'meta' : isAttendance ? 'atendimento' :
      recordType === 'sale' ? 'venda realizada' : 'venda perdida';
    var sellerId = data.sellerId || (!options.isManager ? options.userId : selectedSeller);
    return '<form class="sales-commercial-form" data-sales-record-form data-record-type="' + recordType + '">' +
      '<div class="sales-commercial-form-heading"><h3>' + (record ? 'Editar ' : 'Registrar ') + typeLabel + '</h3>' +
      '<button type="button" class="sales-commercial-link" data-sales-cancel>Cancelar</button></div>' +
      (options.isManager || isGoal ? managerSellerSelect(state, sellerId, true) :
        '<label>Vendedor<input type="text" value="' + escapeHtml(personName(currentProfile(state, options.userId))) + '" readonly></label>') +
      '<label>Data<input type="' + (isGoal ? 'month' : 'date') + '" name="' + (isGoal ? 'month' : 'date') + '" required value="' +
        escapeHtml(isGoal ? data.month || selectedMonth : data.date || todayString()) + '"></label>' +
      (isGoal
        ? '<label>Valor da meta (R$)<input type="number" min="0.01" step="0.01" name="goalAmount" required value="' + escapeHtml(data.goalAmount || '') + '"></label>'
        : '<label>Cliente<input type="text" name="customer" maxlength="160" required value="' + escapeHtml(data.customer || '') + '"></label>' +
          (isAttendance
            ? '<label>Assunto<input type="text" name="subject" maxlength="180" value="' + escapeHtml(data.subject || '') + '"></label>' +
              '<label class="sales-commercial-wide">Resumo do atendimento<textarea name="summary" maxlength="1500" required>' +
                escapeHtml(data.summary || '') + '</textarea></label>' +
              '<label>Situação<select name="attendanceStatus"><option value="Em andamento"' +
                (data.attendanceStatus === 'Em andamento' || !data.attendanceStatus ? ' selected' : '') +
                '>Em andamento</option><option value="Aguardando retorno"' +
                (data.attendanceStatus === 'Aguardando retorno' ? ' selected' : '') +
                '>Aguardando retorno</option><option value="Concluído"' +
                (data.attendanceStatus === 'Concluído' ? ' selected' : '') +
                '>Concluído</option></select></label>' +
              '<label>Próximo contato<input type="date" name="nextContact" value="' + escapeHtml(data.nextContact || '') + '"></label>'
            : '<label>Produto/descrição<input type="text" name="product" maxlength="200" value="' + escapeHtml(data.product || '') + '"></label>' +
              '<label>Valor (R$)<input type="number" min="0" step="0.01" name="amount" required value="' + escapeHtml(data.amount || '') + '"></label>' +
              (recordType === 'lost' ? '<label class="sales-commercial-wide">Motivo da perda<textarea name="reason" maxlength="1000" required>' +
                escapeHtml(data.reason || '') + '</textarea></label>' : ''))) +
      '<button type="submit" class="sales-commercial-primary">' + (record ? 'Salvar alterações' : 'Salvar registro') + '</button></form>';
  }

  function renderList(state, options, type) {
    var records = filteredRecords(state, options).filter(function (record) {
      return record.data.recordType === type;
    }).sort(function (first, second) {
      return String(second.data.date || '').localeCompare(String(first.data.date || ''));
    });
    var typeTitle = type === 'attendance' ? 'Meus atendimentos' :
      type === 'sale' ? 'Vendas realizadas' : 'Vendas perdidas';
    return '<div class="sales-commercial-toolbar"><h3>' + typeTitle +
      '</h3><button type="button" class="sales-commercial-primary" data-sales-new="' + type + '">' +
      (type === 'attendance' ? 'Registrar atendimento' : type === 'sale' ? 'Registrar venda' : 'Registrar perda') + '</button></div>' +
      (newRecordType === type ? recordForm(state, options, null, type) :
        editingRecordId ? recordForm(state, options, records.find(function (record) {
          return String(record.id) === editingRecordId;
        }), type) : '') +
      (records.length ? '<div class="sales-commercial-table-wrap"><table class="sales-commercial-table"><thead><tr>' +
        '<th>Data</th>' + (options.isManager ? '<th>Vendedor</th>' : '') +
        '<th>Cliente</th>' + (type === 'attendance'
          ? '<th>Assunto</th><th>Resumo</th><th>Situação</th><th>Próximo contato</th>'
          : '<th>Produto/descrição</th><th>Valor</th>' + (type === 'lost' ? '<th>Motivo</th>' : '')) +
        '<th></th></tr></thead><tbody>' + records.map(function (record) {
          return '<tr><td>' + dateLabel(record.data.date) + '</td>' +
            (options.isManager ? '<td>' + escapeHtml(sellerLabel(state, record.data.sellerId)) + '</td>' : '') +
            '<td>' + escapeHtml(record.data.customer || '—') + '</td>' +
            (type === 'attendance'
              ? '<td>' + escapeHtml(record.data.subject || '—') + '</td><td>' + escapeHtml(record.data.summary || '—') +
                '</td><td>' + escapeHtml(record.data.attendanceStatus || record.status || 'Em andamento') +
                '</td><td>' + dateLabel(record.data.nextContact) + '</td>'
              : '<td>' + escapeHtml(record.data.product || '—') + '</td><td>' + money(record.data.amount) + '</td>' +
                (type === 'lost' ? '<td>' + escapeHtml(record.data.reason || '—') + '</td>' : '')) +
            '<td>' + (options.isManager || String(record.createdBy) === String(options.userId)
              ? '<button type="button" class="sales-commercial-link" data-sales-edit="' + escapeHtml(record.id) +
                '" aria-label="Editar registro de ' + escapeHtml(record.data.customer || 'venda') + '">Editar</button>'
              : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="sales-commercial-empty">Nenhum registro neste período.</div>');
  }

  function renderWarranties() {
    return '<form class="sales-commercial-filters" data-warranty-search><label>Buscar fabricante' +
      '<input type="search" name="query" value="' + escapeHtml(warrantyQuery) + '" placeholder="Digite o nome do fabricante"></label>' +
      '<button type="submit">Buscar</button></form><div class="sales-commercial-warranty-list">' +
      (warrantiesPromise ? '<div class="sales-commercial-empty">Carregando prazos de garantia…</div>' :
        '<div class="sales-commercial-empty">Carregando prazos de garantia…</div>') + '</div>';
  }

  function fillWarrantyList(root, rows) {
    var query = warrantyQuery.trim().toLocaleLowerCase('pt-BR');
    var filtered = rows.filter(function (item) {
      return !query || [item.fabrica, item.garantia, item.observacao].join(' ').toLocaleLowerCase('pt-BR').indexOf(query) !== -1;
    });
    var container = root.querySelector('.sales-commercial-warranty-list');
    if (!container) return;
    container.innerHTML = filtered.length
      ? '<div class="sales-commercial-table-wrap"><table class="sales-commercial-table"><thead><tr><th>Fabricante</th><th>Prazo</th><th>Observação</th></tr></thead><tbody>' +
        filtered.map(function (item) {
          return '<tr><td>' + escapeHtml(item.fabrica) + '</td><td>' + escapeHtml(item.garantia) +
            '</td><td>' + escapeHtml(item.observacao || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="sales-commercial-note">' +
        filtered.length + ' de ' + rows.length + ' fabricantes</p>'
      : '<div class="sales-commercial-empty">Nenhum fabricante encontrado.</div>';
  }

  function render(root, state, options) {
    var content = activeTab === 'overview'
      ? renderOverview(state, options)
      : activeTab === 'attendance' ? renderList(state, options, 'attendance')
        : activeTab === 'sales' ? renderList(state, options, 'sale')
        : activeTab === 'lost' ? renderList(state, options, 'lost') : renderWarranties();
    root.innerHTML = '<div class="sales-commercial-app">' + renderTabs() +
      (activeTab === 'warranties' ? '' : renderFilters(state, options)) +
      (options.recordsReady === false ? '<div class="sales-commercial-error" role="status">Não foi possível carregar todos os registros do painel. Verifique a conexão e atualize antes de analisar os indicadores.</div>' : '') +
      (formError ? '<div class="sales-commercial-error" role="alert">' + escapeHtml(formError) + '</div>' : '') +
      content + '</div>';
    if (activeTab === 'warranties') {
      loadWarranties().then(function (rows) {
        if (root.isConnected && activeTab === 'warranties') fillWarrantyList(root, rows);
      }).catch(function (error) {
        var list = root.querySelector('.sales-commercial-warranty-list');
        if (list) list.innerHTML = '<div class="sales-commercial-error" role="alert">' +
          escapeHtml(error.message || 'Falha ao carregar os prazos de garantia.') + '</div>';
      });
    }
  }

  function recordPayload(state, options, form) {
    var formData = new FormData(form);
    var recordType = form.dataset.recordType;
    var sellerId = options.isManager ? String(formData.get('sellerId') || '') : String(options.userId || '');
    if (!sellerId) throw new Error('Selecione um vendedor válido.');
    var data = {
      recordType: recordType,
      sellerId: sellerId
    };
    if (recordType === 'goal' && !options.isManager) {
      throw new Error('Somente a gerência pode definir metas.');
    }
    if (recordType === 'goal') {
      data.month = String(formData.get('month') || '');
      data.goalAmount = Number(formData.get('goalAmount'));
      if (!/^\d{4}-\d{2}$/.test(data.month) || !Number.isFinite(data.goalAmount) || data.goalAmount <= 0) {
        throw new Error('Informe um mês e um valor de meta válidos.');
      }
    } else if (recordType === 'attendance') {
      data.date = String(formData.get('date') || '');
      data.month = data.date.slice(0, 7);
      data.customer = String(formData.get('customer') || '').trim();
      data.subject = String(formData.get('subject') || '').trim();
      data.summary = String(formData.get('summary') || '').trim();
      data.attendanceStatus = String(formData.get('attendanceStatus') || 'Em andamento');
      data.nextContact = String(formData.get('nextContact') || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !data.customer || !data.summary ||
          !['Em andamento', 'Aguardando retorno', 'Concluído'].includes(data.attendanceStatus) ||
          (data.nextContact && !/^\d{4}-\d{2}-\d{2}$/.test(data.nextContact))) {
        throw new Error('Preencha os campos obrigatórios do atendimento com valores válidos.');
      }
    } else {
      data.date = String(formData.get('date') || '');
      data.month = data.date.slice(0, 7);
      data.customer = String(formData.get('customer') || '').trim();
      data.product = String(formData.get('product') || '').trim();
      data.amount = Number(formData.get('amount'));
      data.reason = String(formData.get('reason') || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !data.customer ||
          !Number.isFinite(data.amount) || data.amount < 0 ||
          (recordType === 'lost' && !data.reason)) {
        throw new Error('Preencha os campos obrigatórios com valores válidos.');
      }
    }
    return {
      title: recordType === 'goal' ? 'Meta ' + data.month + ' — ' + personName(currentProfile(state, sellerId)) :
        (recordType === 'attendance' ? 'Atendimento — ' : recordType === 'sale' ? 'Venda — ' : 'Venda perdida — ') + data.customer,
      status: recordType === 'goal' ? 'Definida' : recordType === 'attendance'
        ? data.attendanceStatus : recordType === 'sale' ? 'Realizada' : 'Perdida',
      data: data
    };
  }

  async function saveRecord(state, options, form, root) {
    formError = '';
    var existing = moduleRecords(state).find(function (record) { return String(record.id) === editingRecordId; });
    var savedRecord;
    try {
      if (!window.supabaseClient || !window.RildonXSync ||
          typeof window.RildonXSync.createBusinessCardRecord !== 'function') {
        throw new Error('A conexão com o Supabase não está disponível. O registro não foi salvo.');
      }
      var payload = recordPayload(state, options, form);
      if (!existing && payload.data.recordType === 'goal') {
        existing = moduleRecords(state).find(function (record) {
          return record.data.recordType === 'goal' &&
            String(record.data.sellerId) === payload.data.sellerId &&
            String(record.data.month) === payload.data.month;
        });
      }
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      if (existing) {
        if (!options.isManager && String(existing.createdBy) !== String(options.userId)) {
          throw new Error('Você só pode editar os próprios registros.');
        }
        var updateResult = await window.supabaseClient.from('business_card_records').update({
          title: payload.title,
          status: payload.status,
          data: payload.data
        }).eq('id', existing.id).select('*').single();
        if (updateResult.error) throw updateResult.error;
        var row = updateResult.data;
        savedRecord = {
          id: row.id,
          moduleKey: row.module_key,
          sector: row.sector,
          title: row.title,
          status: row.status || 'Pendente',
          data: row.data || {},
          createdBy: row.created_by || null,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
          archived: Boolean(row.archived),
          linkedTaskId: row.linked_task_id || null
        };
      } else {
        if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
          throw new Error('Este navegador não permite gerar um identificador seguro para o registro.');
        }
        savedRecord = await window.RildonXSync.createBusinessCardRecord({
          id: window.crypto.randomUUID(),
          moduleKey: MODULE_KEY,
          sector: 'comercial',
          title: payload.title,
          status: payload.status,
          data: payload.data,
          createdBy: options.userId
        });
        if (!savedRecord) throw new Error('O Supabase não confirmou a gravação do registro.');
      }
      editingRecordId = '';
      newRecordType = '';
      formError = '';
    } catch (error) {
      formError = error && error.message || 'Não foi possível salvar o registro.';
      render(root, state, options);
      return;
    }
    try {
      await window.RildonXSync.refreshBusinessCardRecordsFromSupabase();
    } catch (error) {
      console.error('Registro comercial salvo, mas a atualização da lista remota falhou:', error);
      formError = 'Registro salvo, mas não foi possível atualizar a lista. Atualize a página para confirmar.';
      if (window.RildonXStore && savedRecord) {
        var currentRecords = window.RildonXStore.getState().businessCardRecords || [];
        window.RildonXStore.setRemoteState({
          businessCardRecords: [savedRecord].concat(currentRecords.filter(function (record) {
            return String(record.id) !== String(savedRecord.id);
          }))
        });
      } else {
        render(root, state, options);
      }
    }
  }

  function mount(root, state, options) {
    if (!root) return;
    var settings = Object.assign({ isManager: false, userId: '', recordsReady: true }, options || {});
    render(root, state || {}, settings);
    root.addEventListener('click', function (event) {
      var tabButton = event.target.closest('[data-sales-tab]');
      if (tabButton) {
        activeTab = tabButton.dataset.salesTab;
        editingRecordId = '';
        newRecordType = '';
        formError = '';
        render(root, state, settings);
        return;
      }
      if (event.target.closest('[data-sales-new-goal]')) {
        editingRecordId = '';
        newRecordType = 'goal';
        formError = '';
        render(root, state, settings);
        return;
      }
      var newButton = event.target.closest('[data-sales-new]');
      if (newButton) {
        editingRecordId = '';
        newRecordType = newButton.dataset.salesNew;
        formError = '';
        render(root, state, settings);
        return;
      }
      var editButton = event.target.closest('[data-sales-edit]');
      if (editButton) {
        newRecordType = '';
        editingRecordId = editButton.dataset.salesEdit;
        render(root, state, settings);
        return;
      }
      if (event.target.closest('[data-sales-cancel]')) {
        editingRecordId = '';
        newRecordType = '';
        formError = '';
        render(root, state, settings);
      }
    });
    root.addEventListener('submit', function (event) {
      if (event.target.matches('[data-sales-filter-form]')) {
        event.preventDefault();
        var formData = new FormData(event.target);
        selectedMonth = String(formData.get('month') || selectedMonth);
        selectedSeller = settings.isManager ? String(formData.get('filterSeller') || '') : '';
        editingRecordId = '';
        newRecordType = '';
        formError = '';
        render(root, state, settings);
      } else if (event.target.matches('[data-warranty-search]')) {
        event.preventDefault();
        warrantyQuery = String(new FormData(event.target).get('query') || '');
        loadWarranties().then(function (rows) { fillWarrantyList(root, rows); }).catch(function (error) {
          var list = root.querySelector('.sales-commercial-warranty-list');
          if (list) list.innerHTML = '<div class="sales-commercial-error" role="alert">' +
            escapeHtml(error.message || 'Falha ao buscar fabricantes.') + '</div>';
        });
      } else if (event.target.matches('[data-sales-record-form]')) {
        event.preventDefault();
        saveRecord(state, settings, event.target, root);
      }
    });
  }

  window.RildonXSalesCommercialManagement = { mount: mount };
})();
