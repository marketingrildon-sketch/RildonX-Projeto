(function () {
  'use strict';

  var MODULE_KEY = 'purchase-suppliers';
  var MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var records = [];
  var activeTab = 'overview';
  var search = '';
  var dateFrom = '';
  var dateTo = '';
  var dashboardMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  var dashboardYear = new Date().getFullYear();
  var dashboardCompareYear = '';
  var dashboardMonthFrom = 1;
  var dashboardMonthTo = 12;
  var dashboardBudgetOpen = false;
  var purchaseAreaFilter = '';
  var budgetReferenceMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  var budgetConfigOpen = false;
  var ordersStatusFilter = '';
  var ordersFormOpen = false;
  var selectedEvaluationSupplierId = '';
  var evaluationFormOpen = false;
  var selectedSupplierId = '';
  var selectedComparisonIds = [];
  var comparisonInitialized = false;
  var loading = false;
  var loadError = '';
  var lastLoadedAt = 0;
  var lastAuditLoadedAt = 0;
  var mountedRoot = null;
  var channel = null;
  var auditRecords = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function money(value) {
    if (value === '' || value == null || !Number.isFinite(Number(value))) return 'Sem dados';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function number(value, digits) {
    if (value === '' || value == null || !Number.isFinite(Number(value))) return 'Sem dados';
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  function normalized(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function all(type) {
    return records.filter(function (record) { return record.record_type === type; });
  }

  function recordArea(record) {
    return String(record && record.data && record.data.area || '').trim();
  }

  function areaMatches(record, area) {
    if (!area) return true;
    if (area === '__none__') return !recordArea(record);
    return recordArea(record) === area;
  }

  function availableAreas() {
    var values = all('order').concat(all('budget')).map(recordArea).filter(Boolean);
    if (values.indexOf('Elétrica') === -1) values.push('Elétrica');
    return Array.from(new Set(values)).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }

  function areaSelectMarkup(attribute) {
    var areas = availableAreas();
    return '<label class="pm-field"><span>Área</span><select ' + attribute + '><option value="">Todas as áreas</option>' +
      areas.map(function (area) {
        return '<option value="' + escapeHtml(area) + '"' + (purchaseAreaFilter === area ? ' selected' : '') + '>' +
          escapeHtml(area) + '</option>';
      }).join('') + '<option value="__none__"' + (purchaseAreaFilter === '__none__' ? ' selected' : '') +
      '>Sem área definida</option></select></label>';
  }

  function defaultPurchaseArea() {
    if (purchaseAreaFilter === '__none__') return '';
    return purchaseAreaFilter || 'Elétrica';
  }

  function activeSuppliers() {
    return all('supplier').filter(function (record) { return record.status !== 'Inativo'; });
  }

  function supplierById(id) {
    return all('supplier').find(function (record) { return String(record.id) === String(id); });
  }

  function buyerById(id) {
    return all('buyer').find(function (record) { return String(record.id) === String(id); });
  }

  function recordDate(record) {
    return record && record.data && record.data.orderDate ? new Date(record.data.orderDate + 'T00:00:00') : null;
  }

  function elapsedDays(dateValue) {
    if (!dateValue) return null;
    var date = new Date(dateValue + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
  }

  function inDateRange(date) {
    if (!date || Number.isNaN(date.getTime())) return false;
    var from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    var to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    return (!from || date >= from) && (!to || date <= to);
  }

  function scopedOrders(supplierId) {
    return all('order').filter(function (record) {
      return (!supplierId || String(record.data.supplierId) === String(supplierId)) &&
        (!dateFrom && !dateTo || inDateRange(recordDate(record)));
    });
  }

  function scopedEvaluations(supplierId) {
    return all('evaluation').filter(function (record) {
      if (supplierId && String(record.data.supplierId) !== String(supplierId)) return false;
      if (!dateFrom && !dateTo) return true;
      var issued = record.data.evaluationDate ? new Date(record.data.evaluationDate + 'T00:00:00') : null;
      return inDateRange(issued);
    });
  }

  function orderTerm(order) {
    var start = new Date(order.data.orderDate + 'T00:00:00');
    var end = new Date(order.data.deliveryDate + 'T00:00:00');
    var days = Math.round((end.getTime() - start.getTime()) / 86400000);
    return Number.isFinite(days) && days >= 0 ? days : null;
  }

  function average(values) {
    var valid = values.filter(function (value) { return value !== null && value !== '' && Number.isFinite(Number(value)); });
    return valid.length ? valid.reduce(function (sum, value) { return sum + Number(value); }, 0) / valid.length : null;
  }

  function orderReceived(order) {
    return order.data.received === '' || order.data.received == null ? 0 : Number(order.data.received);
  }

  function orderCancelled(order) {
    if (order.status === 'Cancelado') return Math.max(0, Number(order.data.amount || 0) - orderReceived(order));
    return Number(order.data.cancelled || 0);
  }

  function orderPending(order) {
    return Math.max(0, Number(order.data.amount || 0) - orderReceived(order) - orderCancelled(order));
  }

  function scoreBand(index, thresholds) {
    for (var i = 0; i < thresholds.length; i += 1) {
      if (index <= thresholds[i][0]) return thresholds[i][1];
    }
    return null;
  }

  function evaluationScore(data) {
    var received = Number(data.purchasesReceived);
    var warranty = Number(data.warrantyValue);
    var qualityIndex = received > 0 ? Math.round(warranty / received * 100 * 1000000) / 1000000 : null;
    var quality = qualityIndex == null ? null : scoreBand(qualityIndex, [[0.5, 10], [1, 9], [2, 8], [3, 7], [4, 6], [5, 5], [6, 3]]);
    if (quality == null && data.qualityManual !== '' && data.qualityManual != null &&
        Number.isFinite(Number(data.qualityManual))) quality = Number(data.qualityManual);
    var price = average([data.partnershipScore, data.invoiceScore, data.discountScore]);
    var delivery = data.deliveryScore === '' ? null : Number(data.deliveryScore);
    var requested = Number(data.stockOrder);
    var stockDifference = requested > 0 ? (requested - received) : null;
    var stockIndex = stockDifference == null ? null : Math.round(stockDifference / requested * 100 * 1000000) / 1000000;
    var stock = stockIndex == null ? null : scoreBand(stockIndex, [[0.3, 10], [1, 9], [1.7, 8], [3, 7], [5, 6], [10, 5], [12, 3]]);
    if (stock == null && data.stockManual !== '' && data.stockManual != null &&
        Number.isFinite(Number(data.stockManual))) stock = Number(data.stockManual);
    var finalScore = average([quality, price, delivery, stock]);
    return { qualityIndex: qualityIndex, quality: quality, price: price, delivery: delivery, stockIndex: stockIndex, stock: stock, final: finalScore };
  }

  function monthlyDeliveryAverages(supplierId, year, periodStart, periodEnd) {
    var grouped = MONTHS.map(function () { return []; });
    all('order').forEach(function (order) {
      if (String(order.data.supplierId) !== String(supplierId) || !order.data.orderDate || !order.data.deliveryDate) return;
      if (order.data.orderDate < periodStart || order.data.orderDate > periodEnd) return;
      var date = new Date(order.data.orderDate + 'T00:00:00');
      if (date.getFullYear() !== Number(year)) return;
      var days = orderTerm(order);
      if (days !== null && days <= 366) grouped[date.getMonth()].push(days);
    });
    return grouped.map(function (values) { return values.length ? Math.round(average(values)) : ''; });
  }

  function budgetChain(area) {
    var budgets = all('budget').filter(function (budget) { return areaMatches(budget, area); })
      .slice().sort(function (a, b) { return String(a.data.month).localeCompare(String(b.data.month)); });
    var relevantOrders = all('order').filter(function (order) { return areaMatches(order, area); });
    var observedMonths = budgets.map(function (budget) { return String(budget.data.month || ''); });
    relevantOrders.forEach(function (order) {
      var month = String(order.data.orderDate || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) observedMonths.push(month);
    });
    if (/^\d{4}-\d{2}$/.test(dashboardMonth)) observedMonths.push(dashboardMonth);
    if (/^\d{4}-\d{2}$/.test(budgetReferenceMonth)) observedMonths.push(budgetReferenceMonth);
    if (!observedMonths.length) return [];
    observedMonths.sort();
    var firstMonth = observedMonths[0];
    var lastMonth = observedMonths[observedMonths.length - 1];
    var configured = new Map();
    budgets.forEach(function (budget) {
      var monthBudgets = configured.get(budget.data.month) || [];
      monthBudgets.push(budget);
      configured.set(budget.data.month, monthBudgets);
    });
    var result = [];
    var cursor = new Date(Number(firstMonth.slice(0, 4)), Number(firstMonth.slice(5, 7)) - 1, 1);
    var end = new Date(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)) - 1, 1);
    var opening = 0;
    var openingInitialized = false;
    var iteration = 0;
    while (cursor <= end && iteration < 240) {
      var month = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
      var monthConfigs = configured.get(month) || [];
      var base = monthConfigs.reduce(function (sum, item) {
        return sum + Number(monthlyBudgetBase(item) || 0);
      }, 0);
      if (!openingInitialized && monthConfigs.length) {
        opening = monthConfigs.reduce(function (sum, item) {
          return sum + Number(item.data.openingBalance || 0);
        }, 0);
        openingInitialized = true;
      }
      var monthlyOrders = all('order').filter(function (order) {
        return areaMatches(order, area) && String(order.data.orderDate || '').slice(0, 7) === month;
      });
      var ordered = monthlyOrders.reduce(function (sum, order) { return sum + Number(order.data.amount || 0); }, 0);
      var received = monthlyOrders.reduce(function (sum, order) { return sum + orderReceived(order); }, 0);
      var cancelled = monthlyOrders.reduce(function (sum, order) { return sum + orderCancelled(order); }, 0) +
        monthConfigs.reduce(function (sum, item) { return sum + Number(item.data.unlinkedCancellations || 0); }, 0);
      var available = base + opening;
      var pending = Math.max(0, ordered - received - cancelled);
      var closing = available - ordered + cancelled;
      result.push({
        month: month, configured: Boolean(monthConfigs.length), base: base, opening: opening, available: available,
        ordered: ordered, received: received, cancelled: cancelled, pending: pending,
        afterReceipts: available - received, closing: closing,
        weekly: Math.round(available / Math.max(1, monthConfigs.reduce(function (weeks, item) {
          return Math.max(weeks, Number(item.data.weeks || 4));
        }, 0) || 4) * 100) / 100,
        configId: monthConfigs[0] && monthConfigs[0].id, configData: monthConfigs.map(function (item) { return item.data; })
      });
      opening = closing;
      cursor.setMonth(cursor.getMonth() + 1);
      iteration += 1;
    }
    return result;
  }

  function filtered(type, query) {
    var needle = normalized(query);
    return all(type).filter(function (record) {
      if (!needle) return true;
      return normalized([record.title, record.status, JSON.stringify(record.data || {})].join(' ')).indexOf(needle) !== -1;
    }).sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); });
  }

  function field(label, name, type, value, options, required, min, max, step) {
    var valueText = value == null ? '' : String(value);
    var common = ' name="' + name + '" id="pm-' + name + '" ' + (required ? 'required ' : '') +
      (min != null ? 'min="' + min + '" ' : '') + (max != null ? 'max="' + max + '" ' : '') +
      (step ? 'step="' + step + '" ' : '');
    var control;
    if (type === 'select') {
      control = '<select' + common + '><option value="">Selecione</option>' + (options || []).map(function (option) {
        var optionValue = typeof option === 'string' ? option : option.value;
        var optionLabel = typeof option === 'string' ? option : option.label;
        return '<option value="' + escapeHtml(optionValue) + '"' + (String(optionValue) === valueText ? ' selected' : '') + '>' + escapeHtml(optionLabel) + '</option>';
      }).join('') + '</select>';
    } else if (type === 'textarea') {
      control = '<textarea' + common + ' rows="3">' + escapeHtml(valueText) + '</textarea>';
    } else {
      control = '<input type="' + type + '"' + common + 'value="' + escapeHtml(valueText) + '">';
    }
    return '<label class="pm-field"><span>' + escapeHtml(label) + (required ? ' *' : '') + '</span>' + control + '</label>';
  }

  function supplierOptions(selected) {
    return all('supplier').map(function (supplier) {
      return { value: supplier.id, label: supplier.title + (supplier.status === 'Inativo' ? ' (inativo)' : '') };
    });
  }

  function buyerOptions() {
    return all('buyer').map(function (buyer) {
      return { value: buyer.id, label: buyer.title + (buyer.status === 'Inativo' ? ' (inativo)' : '') };
    });
  }

  function recordForm(type, current, canEdit, forceOpen) {
    if (!canEdit) return '';
    var data = current && current.data || {};
    var id = current && current.id || '';
    var contents = '';
    if (type === 'supplier') {
      contents = field('Fornecedor / fabricante', 'title', 'text', current && current.title, null, true, null, 180) +
        field('Contato responsável', 'contact', 'text', data.contact, null, true, null, 120) +
        field('Telefone', 'phone', 'tel', data.phone, null, true, null, 40) +
        field('E-mail', 'email', 'email', data.email, null, true, null, 180) +
        field('CNPJ (14 dígitos)', 'cnpj', 'text', data.cnpj, null, true, null, 18) +
        field('Endereço', 'address', 'text', data.address, null, true, null, 220) +
        field('Cidade', 'city', 'text', data.city, null, false, null, 100) +
        field('UF', 'state', 'text', data.state, null, false, null, 2) +
        field('Pedido mínimo (R$)', 'minimumOrder', 'number', data.minimumOrder, null, false, 0, null, '0.01') +
        field('Frete padrão', 'freight', 'select', data.freight, ['Não informado', 'FOB', 'CIF', 'FIB'], false) +
        field('Comprador responsável', 'buyerId', 'select', data.buyerId, [{ value: '', label: 'Não informado' }].concat(buyerOptions()), false) +
        field('Particularidades', 'particularities', 'textarea', data.particularities, null, false, null, 4000);
    } else if (type === 'buyer') {
      contents = field('Nome do comprador', 'title', 'text', current && current.title, null, true, null, 120) +
        field('E-mail', 'email', 'email', data.email, null, false, null, 180) +
        field('Contato', 'contact', 'text', data.contact, null, false, null, 120);
    } else if (type === 'order') {
      contents = field('Área', 'area', 'text', data.area || (!id ? defaultPurchaseArea() : ''), null, false, null, 80) +
        field('Fornecedor', 'supplierId', 'select', data.supplierId, supplierOptions(), true) +
        field('Comprador', 'buyerId', 'select', data.buyerId, buyerOptions(), true) +
        field('Número comercial', 'orderNumber', 'text', data.orderNumber, null, false, null, 60) +
        field('Data do pedido', 'orderDate', 'date', data.orderDate, null, true) +
        field('Data de faturamento', 'billingDate', 'date', data.billingDate, null, false) +
        field('Data de entrega', 'deliveryDate', 'date', data.deliveryDate, null, false) +
        field('Valor do pedido (R$)', 'amount', 'number', data.amount, null, true, 0, null, '0.01') +
        field('Condição de pagamento', 'paymentTerms', 'text', data.paymentTerms, null, true, null, 100) +
        field('Tipo de frete', 'freightType', 'select', data.freightType, ['FOB', 'CIF'], true) +
        field('Valor do frete FOB (R$)', 'freightValue', 'number', data.freightValue, null, false, 0, null, '0.01') +
        field('Status operacional', 'status', 'select', current && current.status || data.status, ['Entregue', 'Em Trânsito / Pendente', 'Não Atingiu Pedido Mínimo', 'Suspenso', 'Cancelado'], true) +
        field('Recebido acumulado (R$)', 'received', 'number', data.received, null, false, 0, null, '0.01') +
        field('Cancelado (R$)', 'cancelled', 'number', data.cancelled, null, false, 0, null, '0.01') +
        field('Pedido extra?', 'extra', 'select', String(Boolean(data.extra)), [{ value: 'false', label: 'Não' }, { value: 'true', label: 'Sim' }], true) +
        field('Detalhes do pedido extra', 'extraDetails', 'textarea', data.extraDetails, null, false, null, 1000) +
        field('Observações', 'notes', 'textarea', data.notes, null, false, null, 4000);
    } else if (type === 'evaluation') {
      var scores = evaluationScore(data);
      contents = field('Fornecedor', 'supplierId', 'select', data.supplierId, supplierOptions(), true) +
        field('Data da avaliação', 'evaluationDate', 'date', data.evaluationDate || new Date().toISOString().slice(0, 10), null, true) +
        field('Período inicial', 'periodStart', 'date', data.periodStart, null, true) +
        field('Período final', 'periodEnd', 'date', data.periodEnd, null, true) +
        field('Ano dos prazos mensais', 'year', 'number', data.year || new Date().getFullYear(), null, true, 2000, 2200, 1) +
        field('Avaliador', 'evaluatorId', 'select', data.evaluatorId, buyerOptions(), true) +
        field('Compras recebidas (R$)', 'purchasesReceived', 'number', data.purchasesReceived, null, true, 0.01, null, '0.01') +
        field('Valor em garantia (R$)', 'warrantyValue', 'number', data.warrantyValue, null, true, 0, null, '0.01') +
        field('Nota manual de qualidade, quando acima das faixas', 'qualityManual', 'number', data.qualityManual, null, false, 0, 10, '0.01') +
        field('Parceria / exclusividade (0–10)', 'partnershipScore', 'number', data.partnershipScore, null, true, 0, 10, '0.01') +
        field('Faturamento integral (0–10)', 'invoiceScore', 'number', data.invoiceScore, null, true, 0, 10, '0.01') +
        field('Descontos e negociações (0–10)', 'discountScore', 'number', data.discountScore, null, true, 0, 10, '0.01') +
        field('Nota de entrega (0–10)', 'deliveryScore', 'number', data.deliveryScore, null, true, 0, 10, '0.01') +
        field('Pedido para estoque (R$)', 'stockOrder', 'number', data.stockOrder, null, true, 0.01, null, '0.01') +
        field('Nota manual de estoque, quando acima das faixas', 'stockManual', 'number', data.stockManual, null, false, 0, 10, '0.01') +
        '<div class="pm-monthly-delivery"><b>Prazos mensais de entrega (dias corridos)</b><p>Preenchidos pelo monitoramento por data do pedido; é possível ajustar cada mês manualmente.</p>' +
        '<div class="pm-month-grid">' + MONTHS.map(function (month, index) {
          var days = Array.isArray(data.monthlyDeliveryDays) ? data.monthlyDeliveryDays[index] : '';
          return field(month, 'deliveryMonth' + index, 'number', days, null, false, 0, 366, 1);
        }).join('') + '</div><button type="button" class="btn secondary" data-pm-fill-delivery>Preencher pelo monitoramento</button></div>' +
        '<div class="pm-score-preview">Prévia calculada: qualidade ' + number(scores.quality, 2) + ' · preço ' + number(scores.price, 2) +
        ' · entrega ' + number(scores.delivery, 2) + ' · estoque ' + number(scores.stock, 2) + ' · final ' + number(scores.final, 2) + '</div>' +
        field('Observações', 'notes', 'textarea', data.notes, null, false, null, 4000);
    } else if (type === 'budget') {
      contents = field('Área', 'area', 'text', data.area || (!id ? defaultPurchaseArea() : ''), null, false, null, 80) +
        field('Competência', 'month', 'month', data.month || new Date().toISOString().slice(0, 7), null, true) +
        field('Vendas líquidas do mês anterior × 2 (R$)', 'salesPrevious', 'number', data.salesPrevious, null, false, 0, null, '0.01') +
        field('Custo de reposição anterior (R$)', 'replacementCost', 'number', data.replacementCost, null, false, 0, null, '0.01') +
        field('Frete anterior (R$)', 'freightPrevious', 'number', data.freightPrevious, null, false, 0, null, '0.01') +
        field('ICMS anterior (R$)', 'taxPrevious', 'number', data.taxPrevious, null, false, 0, null, '0.01') +
        field('Orçamento base manual (R$)', 'manualBase', 'number', data.manualBase, null, false, 0, null, '0.01') +
        field('Saldo inicial (R$)', 'openingBalance', 'number', data.openingBalance, null, false, null, null, '0.01') +
        field('Semanas do mês', 'weeks', 'number', data.weeks || 4, null, true, 1, 6, 1) +
        field('Cancelamentos sem vínculo (R$)', 'unlinkedCancellations', 'number', data.unlinkedCancellations, null, false, 0, null, '0.01');
    }
    return '<details class="pm-form" ' + (id || forceOpen ? 'open' : '') + '><summary>' +
      (id ? 'Editar registro' : '+ Novo ' + ({ supplier: 'fornecedor', buyer: 'comprador', order: 'pedido', evaluation: 'avaliação', budget: 'orçamento mensal' }[type])) +
      '</summary><form data-pm-form="' + type + '" data-record-id="' + escapeHtml(id) + '"><div class="pm-form-grid">' + contents +
      '</div><div class="pm-form-actions"><button type="button" class="btn secondary" data-pm-cancel>Cancelar</button><button type="submit" class="btn">Salvar</button></div></form></details>';
  }

  function table(headers, rows, empty) {
    return rows.length
      ? '<div class="pm-table-wrap"><table class="pm-table"><thead><tr>' + headers.map(function (head) { return '<th>' + escapeHtml(head) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>'
      : '<div class="pm-empty">' + escapeHtml(empty || 'Nenhum registro cadastrado.') + '</div>';
  }

  function renderOverview() {
    var monthRecords = all('order').filter(function (order) {
      return areaMatches(order, purchaseAreaFilter) && String(order.data.orderDate || '').slice(0, 7) === dashboardMonth;
    });
    var evaluations = all('evaluation');
    var allOrders = all('order').filter(function (order) { return areaMatches(order, purchaseAreaFilter); });
    var avgScore = average(evaluations.map(function (item) { return evaluationScore(item.data).final; }));
    var avgDelivery = average(allOrders.map(orderTerm));
    var freight = allOrders.filter(function (item) { return item.data.freightType === 'FOB'; })
      .reduce(function (sum, item) { return sum + Number(item.data.freightValue || 0); }, 0);
    var orderTotalAll = allOrders.reduce(function (sum, item) { return sum + Number(item.data.amount || 0); }, 0);
    var monthBudgets = all('budget').filter(function (item) {
      return item.data.month === dashboardMonth && areaMatches(item, purchaseAreaFilter);
    });
    var budget = monthBudgets[0];
    var chain = budgetChain(purchaseAreaFilter);
    var monthBalance = chain.find(function (item) { return item.month === dashboardMonth; });
    var previousMonth = shiftMonth(dashboardMonth, -1);
    var previousBalance = chain.find(function (item) { return item.month === previousMonth; });
    var ordered = monthRecords.reduce(function (sum, item) { return sum + Number(item.data.amount || 0); }, 0);
    var received = monthRecords.reduce(function (sum, item) { return sum + orderReceived(item); }, 0);
    var cancelled = monthRecords.reduce(function (sum, item) { return sum + orderCancelled(item); }, 0) +
      monthBudgets.reduce(function (sum, item) { return sum + Number(item.data.unlinkedCancellations || 0); }, 0);
    var available = monthBalance ? monthBalance.available : 0;
    var pending = Math.max(0, ordered - received - cancelled);
    var salesPrevious = monthBudgets.reduce(function (sum, item) { return sum + Number(item.data.salesPrevious || 0); }, 0);
    var weeklyGoal = monthBalance ? monthBalance.weekly : 0;
    var remaining = Math.max(0, available - ordered + cancelled);
    var cards = [
      ['Fornecedores ativos', activeSuppliers().length],
      ['Fornecedores inativos', all('supplier').length - activeSuppliers().length],
      ['Média de avaliações', number(avgScore, 2)],
      ['Tempo médio geral', avgDelivery == null ? 'Sem dados' : number(avgDelivery, 0) + ' dias'],
      ['Índice de custo com frete FOB', orderTotalAll ? number(freight / orderTotalAll * 100, 2) + '%' : 'Sem dados']
    ];
    var adjustment = '<button type="button" class="btn secondary" data-pm-adjust-budget>' +
      (dashboardBudgetOpen ? 'Fechar parâmetros' : '⚙ Ajustar parâmetros') + '</button>';
    var budgetForm = dashboardBudgetOpen ? recordForm('budget', budget || { id: '', data: {
      month: dashboardMonth, area: defaultPurchaseArea()
    } }, Boolean(mountedRoot && mountedRoot._pmCanEdit)) : '';
    return '<h2 class="pm-dashboard-title">Painel de controle e desempenho</h2><section class="pm-dashboard-budget"><div class="pm-section-head"><h3>▨ Acompanhamento de compras e saldo orçamentário</h3>' +
      (mountedRoot && mountedRoot._pmCanEdit ? adjustment : '') + '</div>' +
      '<div class="pm-dashboard-month">' + areaSelectMarkup('data-pm-area-filter') +
      '<label class="pm-field"><span>Mês do orçamento</span><input type="month" data-pm-dashboard-month value="' +
      escapeHtml(dashboardMonth) + '"></label><small>' + escapeHtml(formatMonth(dashboardMonth)) + ' · ' +
      (budget ? 'Orçamento configurado' : 'Sem orçamento definido') + '</small></div>' + budgetForm +
      '<div class="pm-budget-bars">' + [
        ['Saldo disponível para compra', available, 'green'],
        ['Total pedido', ordered, 'red'],
        ['Total recebido', received, 'yellow'],
        ['Saldo a receber', pending, 'orange']
      ].map(function (item) {
        var width = available > 0 ? Math.min(100, item[1] / available * 100) : item[1] > 0 ? 100 : 0;
        return '<div class="pm-budget-bar"><b>' + escapeHtml(item[0]) + '</b><span class="pm-budget-track"><i class="is-' + item[2] +
          '" style="width:' + width + '%"></i></span><strong>' + escapeHtml(money(item[1])) + '</strong></div>';
      }).join('') + '</div><div class="pm-budget-summary">' +
      [
        ['Vendas de ' + formatMonth(previousMonth), money(salesPrevious)],
        ['Saldo de ' + formatMonth(previousMonth), money(previousBalance ? previousBalance.closing : 0)],
        ['Meta compra semanal', money(weeklyGoal)],
        ['Saldo restante a comprar', money(remaining)]
      ].map(function (item) {
        return '<article><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1]) + '</strong></article>';
      }).join('') + '</div></section>' +
      '<div class="pm-metrics pm-dashboard-metrics">' + cards.map(function (item) {
        return '<article class="pm-metric"><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1]) + '</strong>' +
          (item[0] === 'Índice de custo com frete FOB' ? '<span>Frete FOB: ' + escapeHtml(money(freight)) + '</span>' : '') + '</article>';
      }).join('') + '</div>' +
      '<div class="pm-dashboard-charts"><section class="pm-dashboard-chart"><h3>🏆 Top 10 melhores fornecedores</h3>' +
      renderSupplierRanking() + '</section><section class="pm-dashboard-chart"><h3>🎯 Média por critério</h3>' +
      renderEvaluationCriteria() + '</section></div>' + renderAnnualDashboard();
  }

  function shiftMonth(month, offset) {
    var parts = String(month || '').split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1 + offset, 1);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function formatMonth(month) {
    var parts = String(month || '').split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function monthlyBudgetBase(config) {
    if (!config) return null;
    var data = config.data || {};
    var replacementCost = Number(data.replacementCost || 0);
    var freight = Number(data.freightPrevious || 0);
    var tax = Number(data.taxPrevious || 0);
    var freightRate = replacementCost > 0 ? freight / replacementCost : 0;
    var taxRate = replacementCost > 0 ? tax / replacementCost : 0;
    return data.replacementCost === '' || data.replacementCost == null
      ? Number(data.manualBase || 0)
      : Math.round((replacementCost / (1 + freightRate + taxRate)) * 100) / 100;
  }

  function renderSupplierRanking() {
    var ranking = all('supplier').map(function (supplier) {
      var scores = all('evaluation').filter(function (evaluation) {
        return String(evaluation.data.supplierId) === String(supplier.id);
      }).map(function (evaluation) { return evaluationScore(evaluation.data).final; });
      return { title: supplier.title, score: average(scores) };
    }).filter(function (item) { return item.score != null; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
    if (!ranking.length) return '<div class="pm-empty">Ainda não há avaliações para classificar fornecedores.</div>';
    var width = 660;
    var rowHeight = 32;
    var height = ranking.length * rowHeight + 20;
    return '<svg class="pm-dashboard-ranking" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Classificação dos melhores fornecedores">' +
      ranking.map(function (item, index) {
        var y = index * rowHeight + 18;
        var name = item.title.length > 23 ? item.title.slice(0, 20) + '…' : item.title;
        return '<text x="0" y="' + y + '" class="pm-chart-label">' + escapeHtml(name) + '</text><rect x="200" y="' + (y - 14) +
          '" width="' + Math.max(2, item.score / 10 * 390) + '" height="19" rx="4"></rect><text x="' +
          (208 + Math.max(2, item.score / 10 * 390)) + '" y="' + y + '" class="pm-chart-value">' + escapeHtml(number(item.score, 2)) + '</text>';
      }).join('') + '</svg>';
  }

  function renderEvaluationCriteria() {
    var evaluations = all('evaluation');
    var values = [
      ['Qualidade', average(evaluations.map(function (item) { return evaluationScore(item.data).quality; }))],
      ['Preço', average(evaluations.map(function (item) { return evaluationScore(item.data).price; }))],
      ['Entrega', average(evaluations.map(function (item) { return evaluationScore(item.data).delivery; }))],
      ['Estoque', average(evaluations.map(function (item) { return evaluationScore(item.data).stock; }))]
    ];
    if (!evaluations.length) return '<div class="pm-empty">Ainda não há avaliações cadastradas.</div>';
    var width = 560;
    var height = 250;
    var baseY = 205;
    var barWidth = 72;
    return '<svg class="pm-dashboard-criteria" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Média das avaliações por critério">' +
      [0, 2, 4, 6, 8, 10].map(function (tick) {
        var y = baseY - tick * 17;
        return '<line x1="42" y1="' + y + '" x2="548" y2="' + y + '" class="pm-chart-grid"></line><text x="28" y="' + (y + 4) +
          '" text-anchor="end" class="pm-chart-axis">' + tick + '</text>';
      }).join('') + values.map(function (item, index) {
        var score = item[1] || 0;
        var x = 68 + index * 120;
        var barHeight = score * 17;
        var colors = ['#2f9e5b', '#08a8d7', '#ffc928', '#e34b53'];
        return '<rect x="' + x + '" y="' + (baseY - barHeight) + '" width="' + barWidth + '" height="' + barHeight +
          '" rx="5" fill="' + colors[index] + '"></rect><text x="' + (x + barWidth / 2) + '" y="' + (baseY - barHeight - 8) +
          '" text-anchor="middle" class="pm-chart-value">' + (item[1] == null ? '—' : escapeHtml(number(score, 1))) + '</text><text x="' +
          (x + barWidth / 2) + '" y="228" text-anchor="middle" class="pm-chart-axis">' + escapeHtml(item[0]) + '</text>';
      }).join('') + '</svg>';
  }

  function dashboardYearData(year) {
    var chain = budgetChain(purchaseAreaFilter);
    return MONTHS.map(function (month, index) {
      var key = String(year) + '-' + String(index + 1).padStart(2, '0');
      var configs = all('budget').filter(function (item) {
        return item.data.month === key && areaMatches(item, purchaseAreaFilter);
      });
      var monthlyOrders = all('order').filter(function (order) {
        return areaMatches(order, purchaseAreaFilter) && String(order.data.orderDate || '').slice(0, 7) === key;
      });
      var chainItem = chain.find(function (item) { return item.month === key; });
      return {
        label: month.toUpperCase(),
        orders: monthlyOrders.reduce(function (sum, order) { return sum + Number(order.data.amount || 0); }, 0),
        budget: configs.length ? (chainItem ? chainItem.base : configs.reduce(function (sum, config) {
          return sum + Number(monthlyBudgetBase(config) || 0);
        }, 0)) : null,
        replacement: configs.some(function (config) {
          return config.data.replacementCost !== '' && config.data.replacementCost != null;
        }) ? configs.reduce(function (sum, config) { return sum + Number(config.data.replacementCost || 0); }, 0) : null
      };
    });
  }

  function shortMoney(value) {
    if (value >= 1000000) return 'R$ ' + number(value / 1000000, 1) + ' mi';
    if (value >= 1000) return 'R$ ' + number(value / 1000, 0) + ' mil';
    return 'R$ ' + number(value, 0);
  }

  function renderAnnualChart(primary, comparison) {
    var width = 960;
    var height = 330;
    var left = 84;
    var right = 18;
    var top = 18;
    var bottom = 52;
    var plotWidth = width - left - right;
    var plotHeight = height - top - bottom;
    var series = [
      { name: 'Pedidos ' + dashboardYear, key: 'orders', color: '#0785b7', values: primary },
      { name: 'Orçamento base sem encargos ' + dashboardYear, key: 'budget', color: '#27a567', values: primary },
      { name: 'Custo de reposição do mês anterior ' + dashboardYear, key: 'replacement', color: '#ef9d22', values: primary }
    ];
    if (comparison) {
      series.push({ name: 'Pedidos ' + dashboardCompareYear, key: 'orders', color: '#7357c8', values: comparison });
      series.push({ name: 'Orçamento base ' + dashboardCompareYear, key: 'budget', color: '#83b86c', values: comparison });
      series.push({ name: 'Custo de reposição ' + dashboardCompareYear, key: 'replacement', color: '#d47c52', values: comparison });
    }
    var visible = series.filter(function (item) {
      return item.values.some(function (month, index) {
        return index + 1 >= dashboardMonthFrom && index + 1 <= dashboardMonthTo && month[item.key] != null;
      });
    });
    var max = Math.max(1, visible.reduce(function (maximum, item) {
      return Math.max(maximum, item.values.reduce(function (inner, month, index) {
        return index + 1 >= dashboardMonthFrom && index + 1 <= dashboardMonthTo
          ? Math.max(inner, Number(month[item.key] || 0)) : inner;
      }, 0));
    }, 0));
    var ticks = 4;
    var grid = Array.from({ length: ticks + 1 }, function (_, index) {
      var value = max * (ticks - index) / ticks;
      var y = top + index * plotHeight / ticks;
      return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y +
        '" class="pm-chart-grid"></line><text x="' + (left - 8) + '" y="' + (y + 4) +
        '" text-anchor="end" class="pm-chart-axis">' + escapeHtml(shortMoney(value)) + '</text>';
    }).join('');
    var xPosition = function (index) {
      var visibleCount = dashboardMonthTo - dashboardMonthFrom + 1;
      return left + ((index + 1 - dashboardMonthFrom) / Math.max(1, visibleCount - 1)) * plotWidth;
    };
    var lines = visible.map(function (item) {
      var points = item.values.map(function (month, index) {
        if (index + 1 < dashboardMonthFrom || index + 1 > dashboardMonthTo || month[item.key] == null) return null;
        var value = Number(month[item.key] || 0);
        return { x: xPosition(index), y: top + plotHeight - value / max * plotHeight, value: value };
      }).filter(Boolean);
      var paths = points.map(function (point) { return point.x.toFixed(1) + ',' + point.y.toFixed(1); }).join(' ');
      return (points.length ? '<polyline points="' + paths + '" fill="none" stroke="' + item.color + '" stroke-width="3"></polyline>' +
        points.map(function (point) {
          return '<circle cx="' + point.x + '" cy="' + point.y + '" r="4" fill="' + item.color + '"><title>' +
            escapeHtml(item.name + ': ' + money(point.value)) + '</title></circle>';
        }).join('') : '');
    }).join('');
    var monthLabels = MONTHS.map(function (month, index) {
      if (index + 1 < dashboardMonthFrom || index + 1 > dashboardMonthTo) return '';
      return '<text x="' + xPosition(index) + '" y="' + (height - 20) +
        '" text-anchor="middle" class="pm-chart-axis">' + month.toUpperCase() + '</text>';
    }).join('');
    var legend = visible.map(function (item) {
      return '<span><i style="background:' + item.color + '"></i>' + escapeHtml(item.name) + '</span>';
    }).join('');
    return '<div class="pm-dashboard-annual-chart"><svg viewBox="0 0 ' + width + ' ' + height +
      '" role="img" aria-label="Pedidos, orçamento e custo de reposição por mês">' + grid + lines + monthLabels +
      '</svg></div><div class="pm-chart-legend">' + legend + '</div>';
  }

  function renderAnnualDashboard() {
    var yearOptions = new Set([String(new Date().getFullYear()), String(dashboardYear)]);
    all('order').concat(all('budget')).forEach(function (record) {
      var year = record.record_type === 'budget' ? String(record.data.month || '').slice(0, 4) :
        String(record.data.orderDate || '').slice(0, 4);
      if (/^\d{4}$/.test(year)) yearOptions.add(year);
    });
    var years = Array.from(yearOptions).sort().reverse();
    var options = function (selected, allowNone) {
      return (allowNone ? '<option value="">Sem comparação</option>' : '') + years.map(function (year) {
        return '<option value="' + year + '"' + (String(selected) === year ? ' selected' : '') + '>' + year + '</option>';
      }).join('');
    };
    var primary = dashboardYearData(dashboardYear);
    var comparison = dashboardCompareYear ? dashboardYearData(Number(dashboardCompareYear)) : null;
    var rows = primary.slice(dashboardMonthFrom - 1, dashboardMonthTo).map(function (month, offset) {
      var comparisonMonth = comparison && comparison[dashboardMonthFrom - 1 + offset];
      return '<tr><td>' + month.label + '</td><td>' + escapeHtml(money(month.orders)) + '</td><td>' +
        escapeHtml(month.budget == null ? 'Sem orçamento' : money(month.budget)) + '</td><td>' +
        escapeHtml(month.replacement == null ? 'Não informado' : money(month.replacement)) + '</td>' +
        (dashboardCompareYear ? '<td>' + escapeHtml(money(comparisonMonth.orders)) + '</td><td>' +
          escapeHtml(comparisonMonth.budget == null ? 'Sem orçamento' : money(comparisonMonth.budget)) + '</td><td>' +
          escapeHtml(comparisonMonth.replacement == null ? 'Não informado' : money(comparisonMonth.replacement)) + '</td>' : '') + '</tr>';
    });
    return '<section class="pm-dashboard-annual"><h3>Pedidos mensais, orçamento de compras e custo de reposição</h3>' +
      '<div class="pm-dashboard-filters">' + areaSelectMarkup('data-pm-area-filter') +
      '<label class="pm-field"><span>Ano de referência</span><select data-pm-dashboard-year>' +
      options(dashboardYear, false) + '</select></label><label class="pm-field"><span>Comparar com</span><select data-pm-dashboard-compare>' +
      options(dashboardCompareYear, true) + '</select></label><label class="pm-field"><span>Mês inicial</span><select data-pm-dashboard-from>' +
      MONTHS.map(function (month, index) { return '<option value="' + (index + 1) + '"' +
        (dashboardMonthFrom === index + 1 ? ' selected' : '') + '>' + month.toUpperCase() + '</option>'; }).join('') +
      '</select></label><label class="pm-field"><span>Mês final</span><select data-pm-dashboard-to>' +
      MONTHS.map(function (month, index) { return '<option value="' + (index + 1) + '"' +
        (dashboardMonthTo === index + 1 ? ' selected' : '') + '>' + month.toUpperCase() + '</option>'; }).join('') +
      '</select></label><button type="button" class="btn secondary" data-pm-clear-dashboard-period>Limpar</button></div>' +
      '<p class="pm-help">Orçamento base e custo de reposição vêm das configurações de orçamento; meses sem configuração permanecem sem valor orçado.</p>' +
      renderAnnualChart(primary, comparison) + table(['Mês', 'Pedidos ' + dashboardYear, 'Orçamento base',
        'Custo de reposição anterior'].concat(dashboardCompareYear
        ? ['Pedidos ' + dashboardCompareYear, 'Orçamento base ' + dashboardCompareYear, 'Custo de reposição ' + dashboardCompareYear]
        : []), rows, 'Sem dados para o período selecionado.') + '</section>';
  }

  function renderSuppliers(canEdit) {
    var rows = filtered('supplier', search);
    return recordForm('supplier', null, canEdit) + table(['Fornecedor', 'Contato', 'CNPJ', 'Comprador', 'Pedido mínimo', 'Frete', 'Situação', 'Ações'], rows.map(function (supplier) {
      var data = supplier.data || {};
      var buyer = buyerById(data.buyerId);
      var history = Array.isArray(data.statusHistory) ? data.statusHistory : [];
      var buttons = canEdit ? '<button type="button" class="pm-action" data-pm-edit="' + escapeHtml(supplier.id) + '" data-record-type="supplier">Editar</button>' +
        '<button type="button" class="pm-action" data-pm-toggle="' + escapeHtml(supplier.id) + '">' + (supplier.status === 'Inativo' ? 'Ativar' : 'Inativar') + '</button>' : '';
      return '<tr><td><b>' + escapeHtml(supplier.title) + '</b><small>' + escapeHtml([data.city, data.state].filter(Boolean).join(' · ')) + '</small>' +
        '<details class="pm-details"><summary>Detalhes e histórico</summary><span>' + escapeHtml(data.address || 'Endereço não informado') +
        '</span><span>' + escapeHtml(data.email || 'E-mail não informado') + '</span><span>' +
        escapeHtml(data.particularities || 'Sem particularidades registradas') + '</span>' +
        (history.length ? history.slice().reverse().map(function (entry) {
          return '<small>' + escapeHtml(entry.previousStatus + ' → ' + entry.newStatus + ' · ' + new Date(entry.occurredAt).toLocaleString('pt-BR') +
            (entry.reason ? ' · ' + entry.reason : '')) + '</small>';
        }).join('') : '<small>Sem alterações de situação.</small>') + '</details></td><td>' +
        escapeHtml(data.contact || '') + '<small>' + escapeHtml(data.phone || '') + '</small></td><td>' + escapeHtml(data.cnpj || '') + '</td><td>' +
        escapeHtml(buyer && buyer.title || '—') + '</td><td>' + escapeHtml(money(data.minimumOrder)) + '</td><td>' + escapeHtml(data.freight || 'Não informado') +
        '</td><td><span class="pm-status ' + (supplier.status === 'Inativo' ? 'is-inactive' : '') + '">' + escapeHtml(supplier.status) + '</span></td><td>' + buttons + '</td></tr>';
    }), 'Nenhum fornecedor encontrado.');
  }

  function renderBuyers(canEdit) {
    return recordForm('buyer', null, canEdit) + table(['Comprador', 'E-mail', 'Contato', 'Situação', 'Vínculos'], filtered('buyer', search).map(function (buyer) {
      var linked = all('supplier').filter(function (item) { return item.data.buyerId === buyer.id; }).length +
        all('order').filter(function (item) { return item.data.buyerId === buyer.id || item.data.evaluatorId === buyer.id; }).length;
      return '<tr><td><b>' + escapeHtml(buyer.title) + '</b></td><td>' + escapeHtml(buyer.data.email || '—') + '</td><td>' +
        escapeHtml(buyer.data.contact || '—') + '</td><td><span class="pm-status ' + (buyer.status === 'Inativo' ? 'is-inactive' : '') + '">' + escapeHtml(buyer.status) +
        '</span></td><td>' + linked + (canEdit ? '<button type="button" class="pm-action" data-pm-edit="' + escapeHtml(buyer.id) + '" data-record-type="buyer">Editar</button>' +
          '<button type="button" class="pm-action" data-pm-toggle="' + escapeHtml(buyer.id) + '">' + (buyer.status === 'Inativo' ? 'Ativar' : 'Inativar') + '</button>' : '') + '</td></tr>';
    }), 'Nenhum comprador cadastrado.');
  }

  function renderOrders(canEdit) {
    var orders = filtered('order', search).filter(function (order) {
      return areaMatches(order, purchaseAreaFilter) && ((!dateFrom && !dateTo) || inDateRange(recordDate(order)));
    });
    var supplied = all('supplier').map(function (supplier) {
      var supplierOrders = all('order').filter(function (order) {
        return areaMatches(order, purchaseAreaFilter) && String(order.data.supplierId) === String(supplier.id);
      })
        .sort(function (a, b) { return String(b.data.orderDate || '').localeCompare(String(a.data.orderDate || '')); });
      var latest = supplierOrders[0] || null;
      var days = latest ? elapsedDays(latest.data.orderDate) : null;
      var band = !latest ? 'none' : latest.status === 'Suspenso' || supplier.status === 'Inativo' || days > 45
        ? 'late' : days <= 30 ? 'ontime' : 'attention';
      return { supplier: supplier, orders: supplierOrders, latest: latest, days: days, band: band };
    });
    var counts = {
      ontime: supplied.filter(function (item) { return item.band === 'ontime'; }).length,
      attention: supplied.filter(function (item) { return item.band === 'attention'; }).length,
      late: supplied.filter(function (item) { return item.band === 'late'; }).length
    };
    var noOrders = supplied.filter(function (item) { return item.band === 'none'; });
    var bandNames = { ontime: 'Em dia', attention: 'Atenção', late: 'Ruptura / atraso' };
    var selectedSuppliers = ordersStatusFilter
      ? supplied.filter(function (item) { return item.band === ordersStatusFilter; })
      : [];
    var supplierRows = selectedSuppliers.map(function (item) {
      var buyer = buyerById(item.supplier.data.buyerId);
      return '<tr><td>' + escapeHtml(item.supplier.title) + '</td><td>' + escapeHtml(buyer && buyer.title || '—') +
        '</td><td>' + escapeHtml(item.supplier.status || 'Ativo') + '</td><td>' +
        escapeHtml(item.latest && item.latest.data.orderDate || 'Sem pedido registrado') + '</td><td>' +
        (item.days == null ? '—' : item.days + ' dias') + '</td></tr>';
    });
    var rows = orders.map(function (order) {
      var supplier = supplierById(order.data.supplierId);
      var buyer = buyerById(order.data.buyerId);
      var days = orderTerm(order);
      var actions = canEdit ? '<button type="button" class="pm-action" data-pm-edit="' + escapeHtml(order.id) + '" data-record-type="order">Editar</button>' +
        '<button type="button" class="pm-action pm-danger" data-pm-delete="' + escapeHtml(order.id) + '">Excluir</button>' : '';
      return '<tr><td>' + escapeHtml(order.data.orderNumber || 'Não informado') + '</td><td>' + escapeHtml(recordArea(order) || 'Sem área') +
        '</td><td>' + escapeHtml(supplier && supplier.title || 'Fornecedor removido') +
        '</td><td>' + escapeHtml(buyer && buyer.title || '—') + '</td><td>' + escapeHtml(order.data.orderDate || '') + '</td><td>' +
        escapeHtml(order.data.billingDate || '—') + '</td><td>' + escapeHtml(order.data.deliveryDate || '—') + '<small>' + (days == null ? 'Sem prazo' : days + ' dias') +
        '</small></td><td>' + escapeHtml(order.status) + (order.data.extra === true || order.data.extra === 'true' ? '<small>Pedido extra</small>' : '') +
        '</td><td>' + escapeHtml(money(order.data.amount)) + '</td><td>' + (order.data.received === '' || order.data.received == null ? '<i>Não informado</i>' : escapeHtml(money(order.data.received))) +
        '</td><td>' + escapeHtml(money(orderCancelled(order))) + '</td><td>' + escapeHtml(money(orderPending(order))) + '</td><td>' + actions + '</td></tr>';
    });
    return '<h2 class="pm-dashboard-title">Acompanhamento de pedidos e tempo de entrega</h2>' +
      '<div class="pm-order-metrics">' + [
        ['ontime', 'Em dia (&lt; 30 dias)', counts.ontime],
        ['attention', 'Atenção (31 a 45 dias)', counts.attention],
        ['late', 'Ruptura / atraso (&gt; 45 dias)', counts.late],
        ['', 'Tempo médio geral de entrega', average(all('order').filter(function (order) {
          return areaMatches(order, purchaseAreaFilter);
        }).map(orderTerm)) == null
          ? 'Sem dados' : number(average(all('order').filter(function (order) {
            return areaMatches(order, purchaseAreaFilter);
          }).map(orderTerm)), 0) + ' dias']
      ].map(function (item) {
        return item[0]
          ? '<button type="button" class="pm-metric pm-order-metric is-' + item[0] + (ordersStatusFilter === item[0] ? ' is-selected' : '') +
            '" data-pm-order-status="' + item[0] + '"><small>' + item[1] + '</small><strong>' + item[2] + '</strong></button>'
          : '<article class="pm-metric"><small>' + escapeHtml(item[1]) + '</small><strong>' + escapeHtml(item[2]) + '</strong></article>';
      }).join('') + '</div><div class="pm-dashboard-filters">' + areaSelectMarkup('data-pm-area-filter') +
      '</div><p class="pm-help">Clique nos indicadores para consultar fornecedores da área selecionada. As faixas contam os dias desde o último pedido; fornecedores inativos ou suspensos entram em Ruptura / Atraso. O prazo médio considera entregas válidas.</p>' +
      (noOrders.length ? '<section class="pm-dashboard-chart pm-order-no-orders"><div class="pm-section-head"><div><h3>Fornecedores e fabricantes sem pedido <span class="pm-count">' +
        noOrders.length + '</span></h3><p class="pm-help">Cadastros que ainda não possuem pedido em todo o histórico.</p></div><div class="pm-dashboard-section-actions">' +
        '<button type="button" class="btn secondary" data-pm-export-no-orders>Exportar CSV</button><button type="button" class="btn secondary" data-pm-print>Baixar PDF</button></div></div>' +
        table(['Fornecedor / fabricante', 'Comprador responsável', 'Situação cadastral', 'Histórico'], noOrders.map(function (item) {
          var buyer = buyerById(item.supplier.data.buyerId);
          return '<tr><td>' + escapeHtml(item.supplier.title) + '</td><td>' + escapeHtml(buyer && buyer.title || '—') +
            '</td><td>' + escapeHtml(item.supplier.status || 'Ativo') + '</td><td>Sem pedido registrado</td></tr>';
        }), '') + '</section>' : '') +
      (ordersStatusFilter ? '<section class="pm-dashboard-chart"><div class="pm-section-head"><h3>Fornecedores: ' +
        escapeHtml(bandNames[ordersStatusFilter]) + '</h3><button type="button" class="btn secondary" data-pm-clear-order-status>Limpar filtro</button></div>' +
        table(['Fornecedor / fabricante', 'Comprador responsável', 'Situação cadastral', 'Último pedido', 'Tempo sem pedido'], supplierRows,
          'Nenhum fornecedor nesta faixa.') + '</section>' : '') +
      '<div class="pm-section-head"><h3>Pedidos e entregas</h3><div class="pm-dashboard-section-actions">' +
      (canEdit ? '<button type="button" class="btn" data-pm-toggle-order-form>' + (ordersFormOpen ? 'Fechar formulário' : '+ Lançar novo pedido') + '</button>' : '') +
      '<button type="button" class="btn secondary" data-pm-export>Exportar CSV</button><button type="button" class="btn secondary" data-pm-print>Baixar relatório PDF</button></div></div>' +
      (ordersFormOpen ? recordForm('order', null, canEdit, true) : '') +
      table(['Nº', 'Área', 'Fornecedor', 'Comprador', 'Pedido', 'Faturamento', 'Entrega / prazo', 'Status', 'Valor pedido', 'Recebido', 'Cancelado', 'Pendente', 'Ações'], rows,
        'Nenhum pedido cadastrado.');
  }

  function renderEvaluations(canEdit) {
    var suppliers = all('supplier');
    if (selectedEvaluationSupplierId && !supplierById(selectedEvaluationSupplierId)) selectedEvaluationSupplierId = '';
    var selectedSupplier = supplierById(selectedEvaluationSupplierId);
    var supplierCards = suppliers.map(function (supplier) {
      var evaluations = all('evaluation').filter(function (item) {
        return String(item.data.supplierId) === String(supplier.id);
      });
      var score = average(evaluations.map(function (item) { return evaluationScore(item.data).final; }));
      return '<button type="button" class="pm-evaluation-card' +
        (selectedEvaluationSupplierId === supplier.id ? ' is-selected' : '') + '" data-pm-evaluation-supplier="' +
        escapeHtml(supplier.id) + '"><b>' + escapeHtml(supplier.title) + '</b><strong>' +
        (score == null ? '—' : escapeHtml(number(score, 2)) + '<small> / 10</small>') +
        '</strong><span>' + evaluations.length + ' avaliação(ões) registrada(s)</span></button>';
    }).join('');
    var rows = filtered('evaluation', search).filter(function (item) {
      return !selectedEvaluationSupplierId || String(item.data.supplierId) === String(selectedEvaluationSupplierId);
    }).map(function (item) {
      var supplier = supplierById(item.data.supplierId);
      var buyer = buyerById(item.data.evaluatorId);
      var score = evaluationScore(item.data);
      var lowCount = all('evaluation').filter(function (other) {
        return other.id !== item.id && String(other.data.supplierId) === String(item.data.supplierId) &&
          evaluationScore(other.data).final != null && evaluationScore(other.data).final < 5;
      }).length;
      var recommendation = score.final == null ? 'Sem dados' : score.final >= 5 ? 'Permanecer como fornecedor' :
        lowCount ? 'Notificar, ações corretivas e avaliar exclusão' : 'Notificar, ações corretivas e abrir BO';
      var actions = canEdit ? '<button type="button" class="pm-action" data-pm-edit="' + escapeHtml(item.id) + '" data-record-type="evaluation">Editar</button>' +
        '<button type="button" class="pm-action pm-danger" data-pm-delete="' + escapeHtml(item.id) + '">Excluir</button>' : '';
      return '<tr><td>' + escapeHtml(item.data.evaluationDate || '') + '</td><td>' + escapeHtml(supplier && supplier.title || 'Fornecedor removido') +
        '</td><td>' + escapeHtml(buyer && buyer.title || '—') + '</td><td>' + escapeHtml(number(score.quality, 2)) + '</td><td>' +
        escapeHtml(number(score.price, 2)) + '</td><td>' + escapeHtml(number(score.delivery, 2)) + '</td><td>' + escapeHtml(number(score.stock, 2)) +
        '</td><td><b>' + escapeHtml(number(score.final, 2)) + '</b></td><td>' + escapeHtml(recommendation) + '</td><td>' + actions + '</td></tr>';
    });
    var selectedEvaluations = selectedSupplier ? all('evaluation').filter(function (item) {
      return String(item.data.supplierId) === String(selectedSupplier.id);
    }).sort(function (a, b) { return String(b.data.evaluationDate || '').localeCompare(String(a.data.evaluationDate || '')); }) : [];
    var averages = selectedEvaluations.map(function (item) { return evaluationScore(item.data); });
    var scores = selectedSupplier ? {
      quality: average(averages.map(function (item) { return item.quality; })),
      price: average(averages.map(function (item) { return item.price; })),
      delivery: average(averages.map(function (item) { return item.delivery; })),
      stock: average(averages.map(function (item) { return item.stock; }))
    } : null;
    return '<h2 class="pm-dashboard-title">Avaliação de desempenho por fornecedor</h2><div class="pm-section-head">' +
      (canEdit ? '<button type="button" class="btn" data-pm-toggle-evaluation-form>' +
        (evaluationFormOpen ? 'Fechar avaliação' : '+ Nova avaliação') + '</button>' : '<span></span>') +
      '<div class="pm-dashboard-section-actions"><button type="button" class="btn secondary" data-pm-export>Avaliações CSV</button>' +
      '<button type="button" class="btn" data-pm-print>Baixar relatório PDF</button></div></div>' +
      '<p class="pm-help">Clique em um fornecedor para consultar o histórico de notas e o gráfico de desempenho.</p>' +
      (evaluationFormOpen ? recordForm('evaluation', { id: '', data: { supplierId: selectedEvaluationSupplierId } }, canEdit, true) : '') +
      (supplierCards ? '<div class="pm-evaluation-cards">' + supplierCards + '</div>' :
        '<div class="pm-empty">Cadastre fornecedores para iniciar as avaliações.</div>') +
      (selectedSupplier ? '<section class="pm-dashboard-chart pm-evaluation-detail"><div><h3>' + escapeHtml(selectedSupplier.title) +
        ' · Histórico e desempenho</h3>' + (selectedEvaluations.length ? renderSupplierRadar(scores) :
        '<div class="pm-empty">Este fornecedor ainda não possui avaliações registradas.</div>') + '</div></section>' : '') +
      table(['Data', 'Fornecedor', 'Avaliador', 'Qualidade', 'Preço', 'Entrega', 'Estoque', 'Nota final', 'Recomendação', 'Ações'], rows,
        'Nenhuma avaliação cadastrada.');
  }

  function renderSupplierRadar(scores) {
    var attributes = [
      ['Qualidade', scores.quality],
      ['Preço', scores.price],
      ['Entrega', scores.delivery],
      ['Estoque', scores.stock]
    ];
    var centerX = 180;
    var centerY = 130;
    var radius = 78;
    var points = attributes.map(function (item, index) {
      var angle = -Math.PI / 2 + index * Math.PI / 2;
      var value = Math.max(0, Math.min(10, Number(item[1] || 0)));
      return {
        label: item[0],
        x: centerX + Math.cos(angle) * radius * value / 10,
        y: centerY + Math.sin(angle) * radius * value / 10,
        lx: centerX + Math.cos(angle) * (radius + 24),
        ly: centerY + Math.sin(angle) * (radius + 24),
        value: item[1]
      };
    });
    var grids = [2, 4, 6, 8, 10].map(function (value) {
      var gridPoints = attributes.map(function (_, index) {
        var angle = -Math.PI / 2 + index * Math.PI / 2;
        return (centerX + Math.cos(angle) * radius * value / 10).toFixed(1) + ',' +
          (centerY + Math.sin(angle) * radius * value / 10).toFixed(1);
      }).join(' ');
      return '<polygon points="' + gridPoints + '" class="pm-radar-grid"></polygon>';
    }).join('');
    var labels = points.map(function (point) {
      return '<text x="' + point.lx + '" y="' + (point.ly + 4) + '" text-anchor="middle" class="pm-chart-axis">' +
        escapeHtml(point.label) + (point.value == null ? '' : ' ' + escapeHtml(number(point.value, 1))) + '</text>';
    }).join('');
    return '<svg class="pm-evaluation-radar" viewBox="0 0 360 260" role="img" aria-label="Média das notas por critério">' +
      grids + '<polygon points="' + points.map(function (point) { return point.x.toFixed(1) + ',' + point.y.toFixed(1); }).join(' ') +
      '" class="pm-radar-area"></polygon>' + points.map(function (point) {
        return '<line x1="' + centerX + '" y1="' + centerY + '" x2="' + point.lx + '" y2="' + point.ly +
          '" class="pm-radar-axis"></line>';
      }).join('') + labels + '</svg>';
  }

  function renderBudget(canEdit) {
    var chain = budgetChain(purchaseAreaFilter);
    var monthConfigs = all('budget').filter(function (item) {
      return item.data.month === budgetReferenceMonth && areaMatches(item, purchaseAreaFilter);
    });
    var config = monthConfigs[0];
    var monthlyOrders = all('order').filter(function (order) {
      return areaMatches(order, purchaseAreaFilter) && String(order.data.orderDate || '').slice(0, 7) === budgetReferenceMonth;
    });
    var missingReceived = monthlyOrders.filter(function (order) {
      return order.data.received === '' || order.data.received == null;
    }).length;
    if (!chain.some(function (item) { return item.month === budgetReferenceMonth; })) {
      var previous = chain.find(function (item) { return item.month === shiftMonth(budgetReferenceMonth, -1); });
      var base = monthConfigs.reduce(function (sum, item) { return sum + Number(monthlyBudgetBase(item) || 0); }, 0);
      var ordered = monthlyOrders.reduce(function (sum, order) { return sum + Number(order.data.amount || 0); }, 0);
      var received = monthlyOrders.reduce(function (sum, order) { return sum + orderReceived(order); }, 0);
      var cancelled = monthlyOrders.reduce(function (sum, order) { return sum + orderCancelled(order); }, 0) +
        monthConfigs.reduce(function (sum, item) { return sum + Number(item.data.unlinkedCancellations || 0); }, 0);
      chain.push({
        month: budgetReferenceMonth, configured: Boolean(config), base: base || 0,
        opening: previous ? previous.closing : monthConfigs.reduce(function (sum, item) {
          return sum + Number(item.data.openingBalance || 0);
        }, 0),
        available: (base || 0) + (previous ? previous.closing : monthConfigs.reduce(function (sum, item) {
          return sum + Number(item.data.openingBalance || 0);
        }, 0)),
        ordered: ordered, received: received, cancelled: cancelled,
        pending: Math.max(0, ordered - received - cancelled),
        afterReceipts: (base || 0) + (previous ? previous.closing : monthConfigs.reduce(function (sum, item) {
          return sum + Number(item.data.openingBalance || 0);
        }, 0)) - received,
        closing: (base || 0) + (previous ? previous.closing : monthConfigs.reduce(function (sum, item) {
          return sum + Number(item.data.openingBalance || 0);
        }, 0)) - ordered + cancelled,
        weekly: (base || 0) / Math.max(1, Number(config && config.data.weeks || 4)),
        configId: config && config.id, configData: config && config.data
      });
      chain.sort(function (a, b) { return a.month.localeCompare(b.month); });
    }
    return '<h2 class="pm-dashboard-title">Orçamento de compras</h2>' +
      '<div class="pm-dashboard-filters">' + areaSelectMarkup('data-pm-area-filter') +
      '<label class="pm-field"><span>Mês de referência</span><input type="month" data-pm-budget-month value="' +
      escapeHtml(budgetReferenceMonth) + '"></label>' +
      (canEdit ? '<button type="button" class="btn" data-pm-budget-config>' +
        (budgetConfigOpen ? 'Fechar configuração' : config ? 'Editar mês' : 'Configurar mês') + '</button>' : '') +
      '<button type="button" class="btn secondary" data-pm-refresh>Atualizar dados</button></div>' +
      '<p class="pm-help">' + escapeHtml(formatMonth(budgetReferenceMonth)) + ' · ' +
      (config ? 'Orçamento configurado' : 'Orçamento ainda não configurado') + ' · ' +
      monthlyOrders.length + ' pedido(s) · ' + missingReceived + ' pedido(s) sem valor recebido informado.</p>' +
      '<p class="pm-help">Os parâmetros e cálculos são definidos na configuração do mês. Pedidos, recebimentos e cancelamentos são compartilhados com Pedidos e Entregas.</p>' +
      (budgetConfigOpen && canEdit ? recordForm('budget', config || { id: '', data: { month: budgetReferenceMonth } }, true) : '') +
      '<div class="pm-dashboard-section-actions"><button type="button" class="btn secondary" data-pm-export-budget>Exportar evolução CSV</button>' +
      '<button type="button" class="btn" data-pm-print>Baixar relatório PDF</button></div><h3>Evolução dos saldos mensais</h3>' +
      table(['Mês', 'Base', 'Saldo anterior', 'Disponível', 'Pedidos', 'Recebido', 'Cancelado', 'A receber', 'Saldo seguinte', 'Ações'],
        chain.map(function (month) {
          var rowConfigs = all('budget').filter(function (item) {
            return item.data.month === month.month && areaMatches(item, purchaseAreaFilter);
          });
          var rowConfig = rowConfigs[0];
          var action = canEdit ? '<button type="button" class="pm-action" data-pm-budget-month="' + escapeHtml(month.month) +
            '" data-pm-budget-area="' + escapeHtml(rowConfig ? recordArea(rowConfig) : defaultPurchaseArea()) + '">' +
            (rowConfig ? purchaseAreaFilter ? 'Editar' : 'Editar · ' + escapeHtml(recordArea(rowConfig) || 'Sem área') : 'Configurar') + '</button>' : '';
          return '<tr' + (month.month === budgetReferenceMonth ? ' class="is-selected"' : '') + '><td><b>' + escapeHtml(formatMonth(month.month)) + '</b><small>' +
            (month.configured ? 'Orçamento configurado' : 'Sem orçamento definido') + '</small></td><td>' +
            escapeHtml(money(month.base)) + '</td><td>' + escapeHtml(money(month.opening)) + '</td><td>' +
            escapeHtml(money(month.available)) + '</td><td>' + escapeHtml(money(month.ordered)) + '</td><td>' +
            escapeHtml(money(month.received)) + '</td><td>' + escapeHtml(money(month.cancelled)) + '</td><td>' +
            escapeHtml(money(month.pending)) + '</td><td>' + escapeHtml(money(month.closing)) + '</td><td>' + action + '</td></tr>';
        }), 'Configure o primeiro mês para iniciar a cadeia orçamentária.');
  }

  function renderComparison() {
    var suppliers = all('supplier');
    if (!comparisonInitialized) {
      selectedComparisonIds = suppliers.slice(0, 2).map(function (supplier) { return supplier.id; });
      comparisonInitialized = true;
    }
    var selected = suppliers.filter(function (supplier) { return selectedComparisonIds.indexOf(supplier.id) !== -1; });
    var picker = suppliers.map(function (supplier) {
      return '<label class="pm-compare-option"><input type="checkbox" data-pm-compare="' + escapeHtml(supplier.id) + '"' +
        (selectedComparisonIds.indexOf(supplier.id) !== -1 ? ' checked' : '') + '> ' + escapeHtml(supplier.title) + '</label>';
    }).join('');
    var rows = selected.map(function (supplier) {
      var orders = scopedOrders(supplier.id);
      var evaluations = scopedEvaluations(supplier.id);
      var scores = evaluations.map(function (item) { return evaluationScore(item.data); });
      var guarantees = average(evaluations.map(function (item) {
        return item.data.warrantyValue === '' ? null : Number(item.data.warrantyValue);
      }));
      var billingOrders = orders.filter(function (order) { return Boolean(order.data.billingDate); });
      var deliveryOrders = orders.filter(function (order) { return orderTerm(order) !== null; });
      var freight = orders.filter(function (order) { return order.data.freightType === 'FOB'; })
        .reduce(function (sum, order) { return sum + Number(order.data.freightValue || 0); }, 0);
      return '<tr><th>' + escapeHtml(supplier.title) + '</th><td>' + orders.length + '</td><td>' +
        escapeHtml(money(orders.reduce(function (sum, order) { return sum + Number(order.data.amount || 0); }, 0))) + '</td><td>' +
        escapeHtml(money(orders.filter(function (order) { return order.data.received !== ''; }).reduce(function (sum, order) { return sum + orderReceived(order); }, 0))) +
        '</td><td>' + escapeHtml(money(orders.reduce(function (sum, order) { return sum + orderCancelled(order); }, 0))) + '</td><td>' +
        escapeHtml(money(orders.reduce(function (sum, order) { return sum + orderPending(order); }, 0))) + '</td><td>' +
        escapeHtml(number(average(scores.map(function (score) { return score.final; })), 2)) + '</td><td>' +
        escapeHtml(number(average(scores.map(function (score) { return score.quality; })), 2)) + '</td><td>' +
        escapeHtml(number(average(scores.map(function (score) { return score.price; })), 2)) + '</td><td>' +
        escapeHtml(number(average(scores.map(function (score) { return score.delivery; })), 2)) + '</td><td>' +
        escapeHtml(number(average(scores.map(function (score) { return score.stock; })), 2)) + '</td><td>' +
        escapeHtml(money(guarantees)) + '</td><td>' +
        escapeHtml(average(billingOrders.map(function (order) {
          return (new Date(order.data.billingDate + 'T00:00:00') - new Date(order.data.orderDate + 'T00:00:00')) / 86400000;
        })) == null ? 'Sem dados' : number(average(billingOrders.map(function (order) {
          return (new Date(order.data.billingDate + 'T00:00:00') - new Date(order.data.orderDate + 'T00:00:00')) / 86400000;
        })), 0) + ' dias') + '</td><td>' +
        escapeHtml(average(deliveryOrders.map(orderTerm)) == null ? 'Sem dados' : number(average(deliveryOrders.map(orderTerm)), 0) + ' dias') +
        '</td><td>' + escapeHtml(money(freight)) + '</td><td>' + billingOrders.length + '</td><td>' + deliveryOrders.length + '</td></tr>';
    });
    var metricNames = ['Pedidos', 'Valor pedido', 'Recebido', 'Cancelado', 'Saldo a receber', 'Média final', 'Qualidade', 'Preço',
      'Entrega', 'Estoque', 'Garantia média', 'Prazo faturamento', 'Prazo entrega', 'Frete FOB', 'C/ faturamento', 'C/ entrega'];
    var validSelection = selected.length >= 2 && selected.length <= 5;
    return '<p class="pm-help">Selecione de dois a cinco fornecedores. O intervalo de datas é o mesmo para todos; pedidos usam a data do pedido e avaliações, a data de emissão.</p>' +
      '<div class="pm-compare-picker">' + picker + '</div>' +
      '<div class="pm-compare-period"><label class="pm-field"><span>De</span><input type="date" data-pm-compare-from value="' + escapeHtml(dateFrom) + '"></label>' +
      '<label class="pm-field"><span>Até</span><input type="date" data-pm-compare-to value="' + escapeHtml(dateTo) + '"></label></div>' +
      (validSelection ? '<div class="pm-table-wrap"><table class="pm-table pm-compare-table"><thead><tr><th>Métrica</th>' +
        selected.map(function (supplier) { return '<th>' + escapeHtml(supplier.title) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        metricNames.map(function (metric, index) {
          var values = rows.map(function (row) {
            var cell = document.createElement('template');
            cell.innerHTML = row;
            return cell.content.querySelectorAll('td')[index].textContent;
          });
          return '<tr><th>' + escapeHtml(metric) + '</th>' + values.map(function (value) { return '<td>' + escapeHtml(value) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="pm-empty">Marque de dois a cinco fornecedores para comparar.</div>');
  }

  function renderControl() {
    if (!selectedSupplierId && all('supplier').length) selectedSupplierId = all('supplier')[0].id;
    var options = '<option value="">Selecione um fornecedor</option>' + all('supplier').map(function (supplier) {
      return '<option value="' + escapeHtml(supplier.id) + '"' + (selectedSupplierId === supplier.id ? ' selected' : '') + '>' +
        escapeHtml(supplier.title) + '</option>';
    }).join('');
    var supplier = supplierById(selectedSupplierId);
    var selector = '<div class="pm-control-select"><label class="pm-field"><span>Fornecedor</span><select data-pm-supplier>' +
      options + '</select></label><label class="pm-field"><span>De</span><input type="date" data-pm-control-from value="' +
      escapeHtml(dateFrom) + '"></label><label class="pm-field"><span>Até</span><input type="date" data-pm-control-to value="' +
      escapeHtml(dateTo) + '"></label></div>';
    if (!supplier) return selector + '<div class="pm-empty">Selecione um fornecedor cadastrado.</div>';
    var orders = scopedOrders(supplier.id);
    var evaluations = scopedEvaluations(supplier.id);
    var scores = evaluations.map(function (item) { return evaluationScore(item.data); });
    var billing = average(orders.map(function (order) {
      if (!order.data.billingDate) return null;
      return (new Date(order.data.billingDate + 'T00:00:00') - new Date(order.data.orderDate + 'T00:00:00')) / 86400000;
    }));
    var delivery = average(orders.map(orderTerm));
    var guarantee = average(evaluations.map(function (item) {
      return item.data.warrantyValue === '' ? null : Number(item.data.warrantyValue);
    }));
    var freight = orders.filter(function (order) { return order.data.freightType === 'FOB'; })
      .reduce(function (sum, order) { return sum + Number(order.data.freightValue || 0); }, 0);
    var metrics = [
      ['Pedidos no período', orders.length],
      ['Total comprado', money(orders.reduce(function (sum, order) { return sum + Number(order.data.amount || 0); }, 0))],
      ['Média das avaliações', number(average(scores.map(function (score) { return score.final; })), 2)],
      ['Média de garantias', money(guarantee)],
      ['Tempo médio de faturamento', billing == null ? 'Sem dados' : number(billing, 0) + ' dias'],
      ['Tempo médio de entrega', delivery == null ? 'Sem dados' : number(delivery, 0) + ' dias'],
      ['Frete FOB informado', money(freight)]
    ];
    return selector + '<div class="pm-metrics">' + metrics.map(function (item) {
      return '<article class="pm-metric"><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1]) + '</strong></article>';
    }).join('') + '</div><h3>Pedidos de ' + escapeHtml(supplier.title) + '</h3>' +
      table(['Nº', 'Data', 'Status', 'Pedido', 'Recebido', 'Cancelado', 'Pendente'], orders.map(function (order) {
        return '<tr><td>' + escapeHtml(order.data.orderNumber || 'Não informado') + '</td><td>' + escapeHtml(order.data.orderDate) + '</td><td>' +
          escapeHtml(order.status) + '</td><td>' + escapeHtml(money(order.data.amount)) + '</td><td>' + escapeHtml(money(orderReceived(order))) +
          '</td><td>' + escapeHtml(money(orderCancelled(order))) + '</td><td>' + escapeHtml(money(orderPending(order))) + '</td></tr>';
      }), 'Sem pedidos no período.') + '<h3>Avaliações</h3>' +
      table(['Data da avaliação', 'Período avaliado', 'Qualidade', 'Preço', 'Entrega', 'Estoque', 'Nota final'], evaluations.map(function (item) {
        var score = evaluationScore(item.data);
        return '<tr><td>' + escapeHtml(item.data.evaluationDate) + '</td><td>' + escapeHtml(item.data.periodStart + ' a ' + item.data.periodEnd) +
          '</td><td>' + escapeHtml(number(score.quality, 2)) + '</td><td>' + escapeHtml(number(score.price, 2)) + '</td><td>' +
          escapeHtml(number(score.delivery, 2)) + '</td><td>' + escapeHtml(number(score.stock, 2)) + '</td><td>' +
          escapeHtml(number(score.final, 2)) + '</td></tr>';
      }), 'Sem avaliações no período.');
  }

  function renderAudit() {
    var rows = auditRecords.slice(0, 100);
    return '<p class="pm-help">Auditoria do banco com autoria e retrato anterior/posterior. O histórico de situação dos fornecedores também fica registrado no cadastro.</p>' +
      table(['Operação', 'Tipo', 'Registro', 'Usuário', 'Quando', 'Resumo'], rows.map(function (item) {
        var snapshot = item.after_data || item.before_data || {};
        return '<tr><td>' + escapeHtml(item.operation) + '</td><td>' + escapeHtml(item.record_type) + '</td><td>' +
          escapeHtml(snapshot.title || item.record_id) + '</td><td>' + escapeHtml(item.actor_id || 'Sistema') + '</td><td>' +
          escapeHtml(new Date(item.occurred_at).toLocaleString('pt-BR')) + '</td><td>' +
          escapeHtml(JSON.stringify(item.after_data || item.before_data || {}).slice(0, 180)) + '</td></tr>';
      }), 'Sem operações registradas.');
  }

  function renderMarkup(state, canEdit, standalone, availableTabs) {
    if (!canEdit && activeTab === 'audit') activeTab = 'overview';
    var allTabs = [
      ['overview', 'Painel'], ['supplier', 'Fornecedores'], ['buyer', 'Compradores'],
      ['order', 'Pedidos'], ['evaluation', 'Avaliações'], ['budget', 'Orçamento'],
      ['control', 'Controle individual'], ['comparison', 'Comparativo']
    ].concat(canEdit ? [['audit', 'Rastreabilidade']] : []);
    var tabs = allTabs.filter(function (tab) { return !availableTabs || availableTabs.indexOf(tab[0]) !== -1; });
    var content = activeTab === 'overview' ? renderOverview() :
      activeTab === 'supplier' ? renderSuppliers(canEdit) :
      activeTab === 'buyer' ? renderBuyers(canEdit) :
      activeTab === 'order' ? renderOrders(canEdit) :
      activeTab === 'evaluation' ? renderEvaluations(canEdit) :
      activeTab === 'budget' ? renderBudget(canEdit) :
      activeTab === 'control' ? renderControl() :
      activeTab === 'comparison' ? renderComparison() : renderAudit();
    var searchMarkup = ['supplier', 'buyer', 'order', 'evaluation'].indexOf(activeTab) >= 0
      ? '<label class="pm-search"><span>Buscar</span><input type="search" data-pm-search value="' + escapeHtml(search) + '" placeholder="Nome, CNPJ, contato, pedido..."></label>'
      : '';
    var loadMessage = loading ? '<div class="pm-notice">Carregando registros compartilhados…</div>' :
      loadError ? '<div class="pm-notice is-error">' + escapeHtml(loadError) + '</div>' : '';
    return '<div class="pm-management" data-pm-management>' +
      '<div class="pm-toolbar">' + (!standalone ? '<nav class="pm-tabs" aria-label="Cadastros e controles de gestão">' +
      tabs.map(function (tab) { return '<button type="button" data-pm-tab="' + tab[0] + '" class="' + (activeTab === tab[0] ? 'is-active' : '') + '">' + tab[1] + '</button>'; }).join('') +
      '</nav>' : '') + '<div class="pm-tools">' + searchMarkup + '<button type="button" class="btn secondary" data-pm-refresh>Atualizar</button>' +
      '<button type="button" class="btn secondary" data-pm-export>Exportar CSV</button><button type="button" class="btn secondary" data-pm-print>Relatório / PDF</button></div></div>' +
      '<div class="pm-access-note">' + (canEdit ? 'Perfil Administrador: acesso de edição. Alterações são auditadas no banco.' :
        'Perfil Leitor: consulta e exportação liberadas; gravações protegidas também no banco.') + '</div>' +
      loadMessage + '<div class="pm-content">' + content + '</div></div>';
  }

  async function loadRecords(force) {
    if (loading) return;
    if (!window.supabaseClient) {
      loadError = 'Conexão com o Supabase indisponível. Confirme que o portal foi aberto pelo servidor configurado e tente novamente.';
      console.error('Gestão de fornecedores: cliente Supabase indisponível.');
      renderMounted();
      return;
    }
    if (!force && Date.now() - lastLoadedAt < 30000 &&
        (!mountedRoot || !mountedRoot._pmCanEdit || Date.now() - lastAuditLoadedAt < 30000)) return;
    loading = true;
    loadError = '';
    renderMounted();
    try {
      var result = await window.supabaseClient.from('purchase_management_records')
        .select('*').order('updated_at', { ascending: false });
      if (result.error) throw result.error;
      records = result.data || [];
      if (mountedRoot && mountedRoot._pmCanEdit) {
        var auditResult = await window.supabaseClient.from('purchase_management_audit')
          .select('*').order('occurred_at', { ascending: false }).limit(100);
        if (auditResult.error) throw auditResult.error;
        auditRecords = auditResult.data || [];
        lastAuditLoadedAt = Date.now();
      }
      lastLoadedAt = Date.now();
    } catch (error) {
      loadError = /does not exist|schema cache|relation .* not found/i.test(String(error.message || error))
        ? 'A tabela do painel ainda não foi criada. Aplique docs/supabase-purchase-management.sql no Supabase.'
        : 'Não foi possível carregar os dados do painel. Verifique a conexão e as permissões do Supabase.';
      console.error('Não foi possível carregar a gestão de fornecedores:', error);
    } finally {
      loading = false;
      renderMounted();
    }
  }

  function renderMounted() {
    if (!mountedRoot || !mountedRoot.isConnected) return;
    mountedRoot.innerHTML = renderMarkup(mountedRoot._pmState || {}, Boolean(mountedRoot._pmCanEdit),
      Boolean(mountedRoot._pmStandalone), mountedRoot._pmTabs);
  }

  function mount(root, state, canEdit, options) {
    if (!root) return;
    options = options || {};
    mountedRoot = root;
    root._pmState = state || {};
    root._pmCanEdit = Boolean(canEdit);
    root._pmStandalone = Boolean(options.standalone);
    root._pmTabs = Array.isArray(options.tabs) ? options.tabs : null;
    if (options.initialTab) activeTab = options.initialTab;
    if (!root._pmCanEdit) {
      auditRecords = [];
      lastAuditLoadedAt = 0;
      if (activeTab === 'audit') activeTab = 'overview';
    }
    if (!root.dataset.pmBound) {
      root.dataset.pmBound = 'true';
      root.addEventListener('click', handleClick);
      root.addEventListener('submit', handleSubmit);
      root.addEventListener('input', handleInput);
      root.addEventListener('change', handleChange);
    }
    renderMounted();
    loadRecords(false);
    if (!channel && window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
      channel = window.supabaseClient.channel('purchase-management-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_management_records' }, function () {
          loadRecords(true);
        }).subscribe();
    }
  }

  function handleInput(event) {
    if (event.target.matches('[data-pm-search]')) {
      search = event.target.value;
      var position = event.target.selectionStart;
      renderMounted();
      var input = mountedRoot.querySelector('[data-pm-search]');
      if (input) {
        input.focus();
        input.setSelectionRange(position, position);
      }
    }
  }

  function handleChange(event) {
    if (event.target.matches('[data-pm-area-filter]')) {
      purchaseAreaFilter = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-budget-month]')) {
      budgetReferenceMonth = event.target.value;
      dashboardMonth = budgetReferenceMonth;
      budgetConfigOpen = false;
      renderMounted();
    } else if (event.target.matches('[name="month"]') &&
        event.target.closest('form[data-pm-form="budget"]')) {
      budgetReferenceMonth = event.target.value;
    } else if (event.target.matches('[data-pm-dashboard-month]')) {
      dashboardMonth = event.target.value;
      budgetReferenceMonth = dashboardMonth;
      renderMounted();
    } else if (event.target.matches('[data-pm-dashboard-year]')) {
      dashboardYear = Number(event.target.value);
      renderMounted();
    } else if (event.target.matches('[data-pm-dashboard-compare]')) {
      dashboardCompareYear = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-dashboard-from]')) {
      dashboardMonthFrom = Number(event.target.value);
      if (dashboardMonthFrom > dashboardMonthTo) dashboardMonthTo = dashboardMonthFrom;
      renderMounted();
    } else if (event.target.matches('[data-pm-dashboard-to]')) {
      dashboardMonthTo = Number(event.target.value);
      if (dashboardMonthTo < dashboardMonthFrom) dashboardMonthFrom = dashboardMonthTo;
      renderMounted();
    } else if (event.target.id === 'pm-pm-date-from') {
      dateFrom = event.target.value;
      renderMounted();
    } else if (event.target.id === 'pm-pm-date-to') {
      dateTo = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-control-from], [data-pm-compare-from]')) {
      dateFrom = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-control-to], [data-pm-compare-to]')) {
      dateTo = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-supplier]')) {
      selectedSupplierId = event.target.value;
      renderMounted();
    } else if (event.target.matches('[data-pm-compare]')) {
      var comparisonId = event.target.dataset.pmCompare;
      if (event.target.checked) {
        if (selectedComparisonIds.length >= 5) {
          event.target.checked = false;
          if (window.showToast) window.showToast('O comparativo aceita no máximo cinco fornecedores.');
          return;
        }
        if (selectedComparisonIds.indexOf(comparisonId) === -1) selectedComparisonIds.push(comparisonId);
      } else {
        selectedComparisonIds = selectedComparisonIds.filter(function (id) { return id !== comparisonId; });
      }
      renderMounted();
    } else if (event.target.matches('[name="supplierId"], [name="year"], [name="periodStart"], [name="periodEnd"]')) {
      var form = event.target.closest('form[data-pm-form="evaluation"]');
      if (!form) return;
      var evaluation = records.find(function (record) { return record.id === form.dataset.recordId; });
      var changedContext = evaluation && (
        evaluation.data.supplierId !== form.elements.supplierId.value ||
        String(evaluation.data.year) !== form.elements.year.value ||
        evaluation.data.periodStart !== form.elements.periodStart.value ||
        evaluation.data.periodEnd !== form.elements.periodEnd.value
      );
      if (changedContext && window.confirm('Alterar o fornecedor ou período pode invalidar prazos manuais. Deseja substituir os 12 meses pelos dados do monitoramento?')) {
        fillDeliveryFields(form);
      }
    }
  }

  function fillDeliveryFields(form) {
    var supplierId = form.elements.supplierId.value;
    var year = form.elements.year.value;
    var periodStart = form.elements.periodStart.value;
    var periodEnd = form.elements.periodEnd.value;
    if (!supplierId || !year || !periodStart || !periodEnd) {
      throw new Error('Selecione fornecedor, ano e período antes de preencher os prazos.');
    }
    var values = monthlyDeliveryAverages(supplierId, year, periodStart, periodEnd);
    values.forEach(function (value, index) {
      var input = form.elements['deliveryMonth' + index];
      if (input) input.value = value;
    });
  }

  function currentFormData(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = String(value).trim(); });
    return data;
  }

  function validateAndNormalize(type, data, form) {
    if (type === 'order' || type === 'budget') data.area = String(data.area || '').trim().slice(0, 80);
    if (type === 'supplier') {
      data.cnpj = String(data.cnpj || '').replace(/\D/g, '');
      if (data.cnpj.length !== 14) throw new Error('O CNPJ deve conter 14 dígitos.');
      data.state = String(data.state || '').toUpperCase();
      if (data.minimumOrder && (!Number.isFinite(Number(data.minimumOrder)) || Number(data.minimumOrder) < 0)) {
        throw new Error('O pedido mínimo deve ser um valor não negativo.');
      }
      data.statusChangedAt = data.statusChangedAt || new Date().toISOString();
    } else if (type === 'buyer') {
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Informe um e-mail válido.');
    } else if (type === 'order') {
      var amount = Number(data.amount);
      var received = data.received === '' ? 0 : Number(data.received);
      var cancelled = data.cancelled === '' ? 0 : Number(data.cancelled);
      var supplier = supplierById(data.supplierId);
      var buyer = buyerById(data.buyerId);
      var existingOrder = records.find(function (record) { return record.id === form.dataset.recordId; });
      if (!supplier || !buyer) throw new Error('Selecione um fornecedor e um comprador cadastrados.');
      if (buyer.status === 'Inativo' && (!existingOrder || existingOrder.data.buyerId !== buyer.id)) {
        throw new Error('Um comprador inativo não pode ser vinculado a um novo pedido.');
      }
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('O valor do pedido deve ser maior que zero.');
      if (!Number.isFinite(received) || received < 0 || received > amount) throw new Error('O recebido acumulado deve estar entre zero e o valor pedido.');
      if (!Number.isFinite(cancelled) || cancelled < 0 || cancelled > amount - received) throw new Error('O cancelado deve estar entre zero e o saldo disponível.');
      if (!data.orderDate || data.billingDate && data.billingDate < data.orderDate || data.deliveryDate && data.deliveryDate < data.orderDate) {
        throw new Error('As datas de faturamento e entrega não podem ser anteriores à data do pedido.');
      }
      if (data.status === 'Cancelado') cancelled = amount - received;
      data.amount = String(Math.round(amount * 100) / 100);
      data.received = data.received === '' ? '' : String(Math.round(received * 100) / 100);
      data.cancelled = String(Math.round(cancelled * 100) / 100);
      data.freightValue = data.freightType === 'CIF' ? '0' : String(Math.max(0, Number(data.freightValue || 0)));
      data.extra = data.extra === 'true';
      if (!data.extra) data.extraDetails = '';
    } else if (type === 'evaluation') {
      var purchasesReceived = Number(data.purchasesReceived);
      var warranty = Number(data.warrantyValue);
      var stockOrder = Number(data.stockOrder);
      var existingEvaluation = records.find(function (record) { return record.id === form.dataset.recordId; });
      var evaluator = buyerById(data.evaluatorId);
      if (!supplierById(data.supplierId) || !evaluator) throw new Error('Selecione um fornecedor e um avaliador cadastrados.');
      if (evaluator.status === 'Inativo' && (!existingEvaluation || existingEvaluation.data.evaluatorId !== evaluator.id)) {
        throw new Error('Um comprador inativo não pode ser vinculado a uma nova avaliação.');
      }
      if (data.periodStart > data.periodEnd) throw new Error('O período inicial não pode ser posterior ao período final.');
      if (Number(data.year) < Number(data.periodStart.slice(0, 4)) || Number(data.year) > Number(data.periodEnd.slice(0, 4))) {
        throw new Error('O ano dos prazos deve estar dentro do período avaliado.');
      }
      if (purchasesReceived <= 0 || warranty < 0 || warranty > purchasesReceived) {
        throw new Error('Compras recebidas devem ser maiores que zero e a garantia não pode excedê-las.');
      }
      if (stockOrder <= 0 || purchasesReceived > stockOrder) throw new Error('O pedido para estoque deve ser positivo e cobrir o valor recebido.');
      ['partnershipScore', 'invoiceScore', 'discountScore', 'deliveryScore'].forEach(function (key) {
        if (!Number.isFinite(Number(data[key])) || Number(data[key]) < 0 || Number(data[key]) > 10) throw new Error('As notas devem ficar entre zero e dez.');
      });
      var grade = evaluationScore(data);
      if (grade.quality == null && (data.qualityManual === '' || Number(data.qualityManual) < 0 || Number(data.qualityManual) > 10)) {
        throw new Error('Informe uma nota manual de qualidade entre zero e dez.');
      }
      if (grade.stock == null && (data.stockManual === '' || Number(data.stockManual) < 0 || Number(data.stockManual) > 10)) {
        throw new Error('Informe uma nota manual de estoque entre zero e dez.');
      }
      var monthlyDays = MONTHS.map(function (month, index) {
        var value = data['deliveryMonth' + index];
        delete data['deliveryMonth' + index];
        if (value === '') return '';
        var days = Number(value);
        if (!Number.isInteger(days) || days < 0 || days > 366) throw new Error('Os prazos mensais devem ser inteiros entre zero e 366 dias.');
        return days;
      });
      data.monthlyDeliveryDays = monthlyDays;
      data.monthlyDeliverySources = monthlyDays.map(function (value, index) {
        var automatic = monthlyDeliveryAverages(data.supplierId, data.year, data.periodStart, data.periodEnd)[index];
        return value !== '' && value === automatic ? 'monitoring' : value === '' ? null : 'manual';
      });
      data.stockReceived = data.purchasesReceived;
      data.methodVersion = '3-RHO revisão 1 · 02/01/2025';
      data.qualityIndex = grade.qualityIndex;
      data.stockIndex = grade.stockIndex;
      data.finalScore = grade.final;
      data.classification = grade.final <= 4 ? 'Regular' : grade.final >= 5 && grade.final <= 7 ? 'Bom' :
        grade.final >= 8 && grade.final <= 10 ? 'Ótimo' : 'Fora das faixas literais da metodologia';
    } else if (type === 'budget') {
      if (!/^\d{4}-\d{2}$/.test(data.month) || Number(data.month.slice(5, 7)) < 1 || Number(data.month.slice(5, 7)) > 12) {
        throw new Error('Informe uma competência mensal válida.');
      }
      if (all('budget').some(function (budget) {
        return budget.data.month === data.month && recordArea(budget) === data.area &&
          (!form.dataset.recordId || budget.id !== form.dataset.recordId);
      })) {
        throw new Error('Já existe uma configuração para esta competência e área.');
      }
      if (!Number.isInteger(Number(data.weeks)) || Number(data.weeks) < 1 || Number(data.weeks) > 6) throw new Error('Informe de uma a seis semanas.');
    }
    return data;
  }

  function recordTitle(type, data, existing) {
    if (type === 'supplier' || type === 'buyer') return data.title;
    if (type === 'order') return data.orderNumber || 'Pedido · ' + data.orderDate;
    if (type === 'evaluation') {
      var supplier = supplierById(data.supplierId);
      return 'Avaliação · ' + (supplier && supplier.title || 'Fornecedor') + ' · ' + data.evaluationDate;
    }
    return 'Orçamento · ' + data.month;
  }

  async function saveForm(form) {
    if (!mountedRoot._pmCanEdit) throw new Error('Seu perfil tem acesso de consulta. Solicite permissão de administrador.');
    var type = form.dataset.pmForm;
    var data = validateAndNormalize(type, currentFormData(form), form);
    var existingId = form.dataset.recordId;
    var existing = existingId && records.find(function (record) { return record.id === existingId; });
    var status = type === 'supplier' || type === 'buyer' ? existing && existing.status || 'Ativo' :
      type === 'order' ? data.status : type === 'evaluation' ? 'Avaliado' : 'Configurado';
    var payload = {
      record_type: type,
      title: recordTitle(type, data, existing),
      status: status,
      data: Object.assign({}, data),
      updated_at: new Date().toISOString()
    };
    if (existing) payload.id = existing.id;
    else {
      var auth = await window.supabaseClient.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data.user) throw new Error('Sua sessão expirou. Entre novamente.');
      payload.created_by = auth.data.user.id;
    }
    var result = await window.supabaseClient.from('purchase_management_records').upsert(payload).select('*').single();
    if (result.error) throw result.error;
    var index = records.findIndex(function (record) { return record.id === result.data.id; });
    if (index >= 0) records[index] = result.data;
    else records.unshift(result.data);
    if (type === 'budget') {
      budgetReferenceMonth = data.month;
      dashboardMonth = data.month;
      budgetConfigOpen = false;
    } else if (type === 'order') {
      ordersFormOpen = false;
    } else if (type === 'evaluation') {
      selectedEvaluationSupplierId = data.supplierId;
      evaluationFormOpen = false;
    }
    search = '';
    renderMounted();
    if (window.showToast) window.showToast('Registro salvo.');
  }

  async function deleteRecord(id) {
    if (!mountedRoot._pmCanEdit) return;
    var record = records.find(function (item) { return item.id === id; });
    if (!record) return;
    if (record.record_type === 'supplier' && all('order').concat(all('evaluation')).some(function (item) {
      return String(item.data.supplierId) === String(id);
    })) throw new Error('Este fornecedor possui pedidos ou avaliações vinculados. Inative-o para preservar o histórico.');
    if (record.record_type === 'buyer' && all('supplier').concat(all('order'), all('evaluation')).some(function (item) {
      return item.data.buyerId === id || item.data.evaluatorId === id;
    })) throw new Error('Este comprador possui registros vinculados. Inative-o para preservar o histórico.');
    var result = await window.supabaseClient.from('purchase_management_records').delete().eq('id', id);
    if (result.error) throw result.error;
    records = records.filter(function (item) { return item.id !== id; });
    renderMounted();
    if (window.showToast) window.showToast('Registro excluído.');
  }

  async function changeStatus(id) {
    if (!mountedRoot._pmCanEdit) return;
    var record = records.find(function (item) { return item.id === id; });
    if (!record || !['supplier', 'buyer'].includes(record.record_type)) return;
    var next = record.status === 'Inativo' ? 'Ativo' : 'Inativo';
    if (!window.confirm((next === 'Ativo' ? 'Ativar' : 'Inativar') + ' ' + record.title + '?')) return;
    var reason = window.prompt('Motivo da alteração (opcional):', '') || '';
    var data = Object.assign({}, record.data || {});
    if (record.record_type === 'supplier') {
      data.statusHistory = (Array.isArray(data.statusHistory) ? data.statusHistory : []).concat([{
        previousStatus: record.status, newStatus: next, occurredAt: new Date().toISOString(), reason: reason.slice(0, 1000)
      }]);
      data.statusChangedAt = new Date().toISOString();
    }
    var result = await window.supabaseClient.from('purchase_management_records')
      .update({ status: next, data: data }).eq('id', id).select('*').single();
    if (result.error) throw result.error;
    records = records.map(function (item) { return item.id === id ? result.data : item; });
    renderMounted();
    if (window.showToast) window.showToast('Situação atualizada.');
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var selected = activeTab === 'supplier' ? all('supplier') : activeTab === 'buyer' ? all('buyer') :
      activeTab === 'order' ? all('order') : activeTab === 'evaluation' ? all('evaluation') : activeTab === 'budget' ? all('budget') : records;
    var rows = [['Tipo', 'Registro', 'Situação', 'Dados']];
    selected.forEach(function (record) {
      rows.push([record.record_type, record.title, record.status, JSON.stringify(record.data || {})]);
    });
    downloadCsv('gestao-fornecedores-' + activeTab + '.csv', rows);
  }

  function downloadCsv(filename, rows) {
    var content = '\ufeff' + rows.map(function (row) { return row.map(csvCell).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportBudgetCsv() {
    var areaLabel = purchaseAreaFilter === '__none__' ? 'Sem área definida' : purchaseAreaFilter || 'Todas as áreas';
    var rows = [['Área', 'Mês', 'Orçamento configurado', 'Base', 'Saldo anterior', 'Disponível', 'Pedidos',
      'Recebido', 'Cancelado', 'A receber', 'Saldo seguinte', 'Referência semanal']];
    budgetChain(purchaseAreaFilter).forEach(function (month) {
      rows.push([areaLabel, month.month, month.configured ? 'Sim' : 'Não', month.base, month.opening, month.available,
        month.ordered, month.received, month.cancelled, month.pending, month.closing, month.weekly]);
    });
    downloadCsv('evolucao-saldos.csv', rows);
  }

  function exportNoOrderSuppliersCsv() {
    var rows = [['Fornecedor / fabricante', 'Comprador responsável', 'Situação cadastral', 'Histórico']];
    all('supplier').filter(function (supplier) {
      return !all('order').some(function (order) { return String(order.data.supplierId) === String(supplier.id); });
    }).forEach(function (supplier) {
      var buyer = buyerById(supplier.data.buyerId);
      rows.push([supplier.title, buyer && buyer.title || '', supplier.status || 'Ativo', 'Sem pedido registrado']);
    });
    downloadCsv('fornecedores-sem-pedido.csv', rows);
  }

  function handleClick(event) {
    var tab = event.target.closest('[data-pm-tab]');
    if (tab) {
      activeTab = tab.dataset.pmTab;
      search = '';
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-refresh]')) {
      loadRecords(true);
      return;
    }
    if (event.target.closest('[data-pm-export]')) {
      exportCsv();
      return;
    }
    if (event.target.closest('[data-pm-print]')) {
      window.print();
      return;
    }
    if (event.target.closest('[data-pm-export-budget]')) {
      exportBudgetCsv();
      return;
    }
    if (event.target.closest('[data-pm-export-no-orders]')) {
      exportNoOrderSuppliersCsv();
      return;
    }
    if (event.target.closest('[data-pm-budget-config]')) {
      budgetConfigOpen = !budgetConfigOpen;
      renderMounted();
      return;
    }
    var budgetMonthButton = event.target.closest('[data-pm-budget-month]');
    if (budgetMonthButton) {
      budgetReferenceMonth = budgetMonthButton.dataset.pmBudgetMonth;
      dashboardMonth = budgetReferenceMonth;
      if (budgetMonthButton.hasAttribute('data-pm-budget-area')) {
        purchaseAreaFilter = budgetMonthButton.dataset.pmBudgetArea || '__none__';
      }
      budgetConfigOpen = true;
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-toggle-order-form]')) {
      ordersFormOpen = !ordersFormOpen;
      renderMounted();
      return;
    }
    var orderStatusButton = event.target.closest('[data-pm-order-status]');
    if (orderStatusButton) {
      ordersStatusFilter = ordersStatusFilter === orderStatusButton.dataset.pmOrderStatus
        ? '' : orderStatusButton.dataset.pmOrderStatus;
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-clear-order-status]')) {
      ordersStatusFilter = '';
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-toggle-evaluation-form]')) {
      evaluationFormOpen = !evaluationFormOpen;
      renderMounted();
      return;
    }
    var evaluationSupplierButton = event.target.closest('[data-pm-evaluation-supplier]');
    if (evaluationSupplierButton) {
      selectedEvaluationSupplierId = selectedEvaluationSupplierId === evaluationSupplierButton.dataset.pmEvaluationSupplier
        ? '' : evaluationSupplierButton.dataset.pmEvaluationSupplier;
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-cancel]')) {
      var cancelledForm = event.target.closest('form[data-pm-form]');
      if (cancelledForm) {
        if (cancelledForm.dataset.pmForm === 'budget') budgetConfigOpen = false;
        if (cancelledForm.dataset.pmForm === 'order') ordersFormOpen = false;
        if (cancelledForm.dataset.pmForm === 'evaluation') evaluationFormOpen = false;
      }
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-clear-dates]')) {
      dateFrom = '';
      dateTo = '';
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-adjust-budget]')) {
      dashboardBudgetOpen = !dashboardBudgetOpen;
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-clear-dashboard-period]')) {
      dashboardYear = new Date().getFullYear();
      dashboardCompareYear = '';
      dashboardMonthFrom = 1;
      dashboardMonthTo = 12;
      renderMounted();
      return;
    }
    if (event.target.closest('[data-pm-fill-delivery]')) {
      var evaluationForm = event.target.closest('form[data-pm-form="evaluation"]');
      if (evaluationForm) {
        try {
          fillDeliveryFields(evaluationForm);
        } catch (error) {
          showActionError(error);
        }
      }
      return;
    }
    var edit = event.target.closest('[data-pm-edit]');
    if (edit) {
      var record = records.find(function (item) { return item.id === edit.dataset.pmEdit; });
      if (!record) return;
      activeTab = record.record_type;
      var container = mountedRoot.querySelector('.pm-content');
      if (!container) return;
      container.innerHTML = recordForm(record.record_type, record, Boolean(mountedRoot._pmCanEdit)) + container.innerHTML;
      var form = container.querySelector('form[data-pm-form="' + record.record_type + '"]');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var toggle = event.target.closest('[data-pm-toggle]');
    if (toggle) {
      changeStatus(toggle.dataset.pmToggle).catch(showActionError);
      return;
    }
    var deleteButton = event.target.closest('[data-pm-delete]');
    if (deleteButton) {
      if (window.confirm('Excluir este registro? Esta ação ficará registrada na auditoria.')) {
        deleteRecord(deleteButton.dataset.pmDelete).catch(showActionError);
      }
    }
  }

  function showActionError(error) {
    console.error('Falha na gestão de fornecedores:', error);
    if (window.showToast) window.showToast(error.message || 'Não foi possível concluir a operação.');
  }

  function handleSubmit(event) {
    var form = event.target.closest('form[data-pm-form]');
    if (!form) return;
    event.preventDefault();
    var submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    saveForm(form).catch(showActionError).finally(function () {
      if (submit && submit.isConnected) submit.disabled = false;
    });
  }

  window.RildonXSupplierManagement = { mount: mount };
})();
