const notificationRepository = require("../repositories/notificationRepository");
const { buildPagination } = require("../helpers/buildPagination");
const AppError = require("../helpers/AppError");

const listarPorUsuario = async (userId, query) => {
  const { page, limit, skip } = buildPagination(query, 10);

  const [notifications, total, unreadCount] = await Promise.all([
    notificationRepository.findByUser(userId, { skip, limit }),
    notificationRepository.countByUser(userId),
    notificationRepository.countUnreadByUser(userId),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const marcarLeida = async (notificationId, userId) => {
  const notification = await notificationRepository.findById(notificationId);
  if (!notification) throw new AppError("Notificacion no encontrada", 404);
  if (notification.user.toString() !== userId.toString()) {
    throw new AppError("No autorizado", 403);
  }

  if (notification.isRead) return notification;

  return notificationRepository.updateById(notificationId, { isRead: true });
};

const marcarTodasLeidas = async (userId) => {
  const result = await notificationRepository.markAllAsReadByUser(userId);

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
};

module.exports = {
  listarPorUsuario,
  marcarLeida,
  marcarTodasLeidas,
};
