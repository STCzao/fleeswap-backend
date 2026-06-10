const mongoose = require("mongoose");
const { buildNotificationDedupeKey } = require("../helpers/notificationDedupe");

const NOTIFICATION_TYPES = [
  "active_search_match",
  "exchange_request_received",
  "exchange_request_accepted",
  "exchange_request_rejected",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: NOTIFICATION_TYPES,
        message: "Tipo de notificacion invalido",
      },
    },
    title: {
      type: String,
      required: true,
      maxlength: [120, "El titulo no puede superar los 120 caracteres"],
    },
    message: {
      type: String,
      required: true,
      maxlength: [300, "El mensaje no puede superar los 300 caracteres"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    dedupeKey: {
      type: String,
      required: true,
    },
    publication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      default: null,
    },
    activeSearch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActiveSearch",
      default: null,
    },
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exchange",
      default: null,
    },
    metadata: {
      publicationTitle: {
        type: String,
        default: null,
      },
      publicationPhoto: {
        type: String,
        default: null,
      },
      publicationCategory: {
        type: String,
        default: null,
      },
      publicationType: {
        type: String,
        default: null,
      },
      publicationOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      publicationOwnerName: {
        type: String,
        default: null,
      },
      exchangeType: {
        type: String,
        default: null,
      },
      requesterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      requesterName: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true },
);

// Evita duplicados si por error la misma notificacion se procesa mas de una vez
// para el mismo usuario y el mismo evento de dominio.
notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: { $exists: true, $type: "string" },
    },
  },
);

notificationSchema.pre("validate", function () {
  if (!this.dedupeKey) {
    this.dedupeKey = buildNotificationDedupeKey({
      type: this.type,
      activeSearch: this.activeSearch,
      publication: this.publication,
      exchange: this.exchange,
    });
  }
});

module.exports = mongoose.model("Notification", notificationSchema);
