routerAdd(
  'POST',
  '/backend/v1/analytics/summary',
  (e) => {
    try {
      var body = e.requestInfo().body || {}
      var periodDays = body.period || 7
      var includeDemo = body.includeDemo || false

      var storeRecord = null
      try {
        var stores = $app.findRecordsByFilter('stores', "id != ''", 'created', 1, 0)
        if (stores.length > 0) storeRecord = stores[0]
      } catch (_) {}
      var storesId = storeRecord ? storeRecord.id : ''
      var shopifyConnected = storeRecord ? storeRecord.getBool('connected') : false

      var now = new Date()
      var periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)
      var prevPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000)

      var orders = $app.findRecordsByFilter('orders', "id != ''", '-created', 500, 0)

      var periodOrders = []
      var prevPeriodOrders = []

      for (var i = 0; i < orders.length; i++) {
        var o = orders[i]
        var created = o.getString('created')
        var orderDate = new Date(created)

        if (orderDate >= periodStart) {
          periodOrders.push(o)
        } else if (orderDate >= prevPeriodStart && orderDate < periodStart) {
          prevPeriodOrders.push(o)
        }
      }

      var totalRevenue = 0
      var paidOrdersCount = 0

      for (var i = 0; i < periodOrders.length; i++) {
        var o = periodOrders[i]
        var st = o.getString('status')
        if (st === 'paid' || st === 'shipped' || st === 'delivered') {
          totalRevenue += o.getFloat('total')
          paidOrdersCount++
        }
      }

      var prevRevenue = 0
      var prevPaidOrders = 0

      for (var i = 0; i < prevPeriodOrders.length; i++) {
        var o = prevPeriodOrders[i]
        var st = o.getString('status')
        if (st === 'paid' || st === 'shipped' || st === 'delivered') {
          prevRevenue += o.getFloat('total')
          prevPaidOrders++
        }
      }

      var ticketMedio = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : null
      var prevTicketMedio = prevPaidOrders > 0 ? prevRevenue / prevPaidOrders : null

      var products = $app.findRecordsByFilter('products', "id != ''", '-sales_count', 100, 0)

      var campaigns = $app.findRecordsByFilter('campaigns', "id != ''", '-created', 50, 0)

      var totalSpend = 0
      for (var i = 0; i < campaigns.length; i++) {
        totalSpend += campaigns[i].getFloat('spend')
      }

      var cpa = paidOrdersCount > 0 ? totalSpend / paidOrdersCount : null
      var roas = totalSpend > 0 ? totalRevenue / totalSpend : null

      var visitsCount = null
      var conversionRate = null

      var lowStockProducts = []
      for (var i = 0; i < products.length; i++) {
        if (products[i].getInt('stock') <= 5) {
          lowStockProducts.push({
            id: products[i].id,
            name: products[i].getString('name'),
            stock: products[i].getInt('stock'),
            price: products[i].getFloat('price'),
          })
        }
      }

      var topProducts = []
      var productRevenueMap = {}
      for (var i = 0; i < periodOrders.length; i++) {
        var o = periodOrders[i]
        var st = o.getString('status')
        if (st !== 'paid' && st !== 'shipped' && st !== 'delivered') continue
        var itemsStr = o.getString('items')
        if (!itemsStr) continue
        try {
          var items = JSON.parse(itemsStr)
          if (!Array.isArray(items)) continue
          for (var j = 0; j < items.length; j++) {
            var item = items[j]
            var pId = item.shopify_product_id || item.title || ''
            if (!pId) continue
            if (!productRevenueMap[pId]) {
              productRevenueMap[pId] = { revenue: 0, qty: 0, name: item.title || pId }
            }
            productRevenueMap[pId].revenue += (item.price || 0) * (item.quantity || 1)
            productRevenueMap[pId].qty += item.quantity || 1
          }
        } catch (_) {}
      }

      var sortedProducts = Object.keys(productRevenueMap)
        .map(function (key) {
          return {
            id: key,
            name: productRevenueMap[key].name,
            sales_count: productRevenueMap[key].qty,
            price: 0,
            stock: 0,
          }
        })
        .sort(function (a, b) {
          return b.sales_count - a.sales_count
        })

      topProducts = sortedProducts.slice(0, 5)

      var revenueData = {}
      for (var i = 0; i < periodOrders.length; i++) {
        var o = periodOrders[i]
        var st = o.getString('status')
        if (st !== 'paid' && st !== 'shipped' && st !== 'delivered') continue
        var dateStr = o.getString('created').substring(0, 10)
        if (!revenueData[dateStr]) revenueData[dateStr] = { date: dateStr, revenue: 0, orders: 0 }
        revenueData[dateStr].revenue += o.getFloat('total')
        revenueData[dateStr].orders++
      }

      var revenueDataArr = Object.keys(revenueData)
        .sort()
        .map(function (key) {
          return revenueData[key]
        })

      function calcVariation(current, previous) {
        if (previous === null || previous === 0 || previous === undefined) return null
        if (current === null || current === undefined) return null
        return ((current - previous) / previous) * 100
      }

      return e.json(200, {
        totalRevenue: periodOrders.length > 0 ? totalRevenue : null,
        totalOrders: periodOrders.length,
        paidOrdersCount: paidOrdersCount,
        ticketMedio: ticketMedio,
        conversionRate: conversionRate,
        totalSpend: totalSpend > 0 ? totalSpend : null,
        cpa: cpa,
        roas: roas,
        visitsCount: visitsCount,
        lowStockProducts: lowStockProducts,
        topProducts: topProducts,
        revenueData: revenueDataArr,
        variations: {
          revenue: calcVariation(totalRevenue, prevRevenue),
          orders: calcVariation(periodOrders.length, prevPeriodOrders.length),
          ticketMedio: calcVariation(ticketMedio, prevTicketMedio),
        },
        period: periodDays,
        shopifyConnected: shopifyConnected,
      })
    } catch (err) {
      return e.internalServerError('Falha ao calcular métricas: ' + String(err))
    }
  },
  $apis.requireAuth(),
)
