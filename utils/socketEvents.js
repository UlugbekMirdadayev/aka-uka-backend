/**
 * Socket.IO Event Utils
 * Утилиты для отправки Socket.IO событий
 */

/**
 * Отправить событие о новом заказе
 * @param {Object} io - Socket.IO экземпляр
 * @param {Object} order - Данные заказа
 */
const emitNewOrder = (io, order) => {
  try {
    // Отправить всем подключенным клиентам
    io.emit('new_order', {
      id: order._id,
      client: order.client,
      products: order.products,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      debtAmount: order.debtAmount,
      paymentType: order.paymentType,
      status: order.status,
      profitAmount: order.profitAmount,
      createdAt: order.createdAt,
      notes: order.notes,
      car: order.car,
      index: order.index
    });

    console.log(`Socket event 'new_order' отправлен для заказа ${order._id}`);
  } catch (error) {
    console.error('Ошибка при отправке события new_order:', error.message);
  }
};

/**
 * Отправить событие об обновлении заказа
 * @param {Object} io - Socket.IO экземпляр
 * @param {Object} order - Обновленные данные заказа
 */
const emitOrderUpdate = (io, order) => {
  try {
    io.emit('order_updated', {
      id: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
      paidAmount: order.paidAmount,
      debtAmount: order.debtAmount,
      car: order.car,
      index: order.index,
      updatedAt: new Date()
    });

    console.log(`Socket event 'order_updated' отправлен для заказа ${order._id}`);
  } catch (error) {
    console.error('Ошибка при отправке события order_updated:', error.message);
  }
};

module.exports = {
  emitNewOrder,
  emitOrderUpdate
};
