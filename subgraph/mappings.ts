import { OrderCreated, OrderCancelled, OrderFailed, OrderExecuted, OrderFilled, OrderPushed } from '../generated/NineInchDCA/NineInchDCA'
import { DCAOrder, SubOrder } from '../generated/schema'

export function handleOrderCreated(event: OrderCreated): void {
  let order = new DCAOrder(event.params.orderId.toHexString())
  order.amountIn = event.params.amountIn
  order.tokenIn = event.params.tokenIn.toHexString()
  order.tokenOut = event.params.tokenOut.toHexString()
  order.numOfOrders = event.params.numOfOrders
  order.interval = event.params.interval
  order.user = event.params.user.toHexString()
  order.createdAt = event.block.timestamp
  order.createdHash = event.transaction.hash.toHexString()
  order.status = "open"
  // order.executedOrders = new Array<string>()
  order.executedOrders = []
  order.save()
}

export function handleOrderPushed(event: OrderPushed): void {
  let order = DCAOrder.load(event.params.order.orderId.toHexString())
  if(order) {
    // order = new DCAOrder(event.params.order.orderId.toHexString())
    // order.amountIn = event.params.order.amountIn
    // order.tokenIn = event.params.order.path[0].toHexString()
    // order.tokenOut = event.params.order.path[event.params.order.path.length - 1].toHexString()
    // order.numOfOrders = event.params.order.numOfOrders
    // order.interval = event.params.order.interval
    // order.user = event.params.order.user.toHexString()
    order.minPrice = event.params.order.minPrice
    order.maxPrice = event.params.order.maxPrice
    // order.createdAt = event.block.timestamp
    // order.createdHash = event.transaction.hash.toHexString()
    // order.status = "pushed"
    // order.executedOrders = new Array<string>()
    // order.executedOrders = []
    order.save()
  }
}

export function handleOrderCancelled(event: OrderCancelled): void {
  let order = DCAOrder.load(event.params.orderId.toHexString())
  if (order) {
    order.closedAt = event.block.timestamp
    order.closedHash = event.transaction.hash.toHexString()
    order.status = "cancelled"
    order.save()
  }
}

export function handleOrderFailed(event: OrderFailed): void {
  let order = DCAOrder.load(event.params.orderId.toHexString())
  if (order) {
    order.closedAt = event.block.timestamp
    order.closedHash = event.transaction.hash.toHexString()
    order.status = "failed"
    order.save()
  }
}

export function handleOrderExecuted(event: OrderExecuted): void {
  let order = DCAOrder.load(event.params.orderId.toHexString())
  if (order) {
    // order.amountIn = event.params.amountIn
    order.status = "executed"
    let subOrder = SubOrder.load(event.params.subOrderId.toHexString())
    if (!subOrder) {
      subOrder = new SubOrder(event.params.subOrderId.toHexString())
      subOrder.amountIn = event.params.amountIn
      subOrder.amountOut = event.params.amountOut
      subOrder.executedAt = event.block.timestamp
      subOrder.executedHash = event.transaction.hash.toHexString()
      subOrder.rate = event.params.rate
      subOrder.dcaOrderId = order.id
      subOrder.save() // Save the new SubOrder
    } else {
      subOrder.amountIn = event.params.amountIn
      subOrder.amountOut = event.params.amountOut
      subOrder.executedAt = event.block.timestamp
      subOrder.executedHash = event.transaction.hash.toHexString()
      subOrder.rate = event.params.rate
      subOrder.dcaOrderId = order.id
      subOrder.save() // Update the existing SubOrder
    }

    let executedOrders: Array<string> = order.executedOrders
    executedOrders.push(subOrder.id)
    order.executedOrders = executedOrders
    order.save()
  }
}
export function handleOrderFilled(event: OrderFilled): void {
  let order = DCAOrder.load(event.params.orderId.toHexString())
  if (order) {
    // order.amountIn = event.params.amountIn
    order.closedAt = event.block.timestamp
    order.closedHash = event.transaction.hash.toHexString()
    order.status = "filled"
    order.save()
  }
}