const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

const recordAudit = async (req, action, target = {}, metadata = {}) => {
  try {
    const actorId = req.user?._id;
    await AuditLog.create({
      actorId: mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined,
      actorRole: req.user?.role || '',
      action,
      targetType: target.type || '',
      targetId: target.id ? String(target.id) : '',
      metadata,
      ip: req.ip || '',
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { recordAudit };
