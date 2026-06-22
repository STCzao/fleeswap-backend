const Notification = require("../models/Notification");

const create = (data) => Notification.create(data);

const findByUser = (userId, { skip, limit }) =>
  Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

const countByUser = (userId) => Notification.countDocuments({ user: userId });

const countUnreadByUser = (userId) =>
  Notification.countDocuments({ user: userId, isRead: false });

const findById = (id) => Notification.findById(id);

const updateById = (id, data) =>
  Notification.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });

const markAllAsReadByUser = (userId) =>
  Notification.updateMany({ user: userId, isRead: false }, { isRead: true });

module.exports = {
  create,
  findByUser,
  countByUser,
  countUnreadByUser,
  findById,
  updateById,
  markAllAsReadByUser,
};
