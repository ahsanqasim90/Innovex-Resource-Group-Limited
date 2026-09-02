import mongoose from "mongoose";
import { currentOrganizationId, currentTenant, isDefaultOrganization } from "./tenantContext.js";

const queryOperations = [
  "count",
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne"
];

function tenantMatch(organizationId) {
  if (isDefaultOrganization(organizationId)) {
    return { $or: [{ organization: organizationId }, { organization: { $exists: false } }] };
  }
  return { organization: organizationId };
}

function scopedFilter(filter, organizationId, withArchived) {
  const constraints = [filter || {}, tenantMatch(organizationId)];
  if (!withArchived) constraints.push({ archivedAt: null });
  return { $and: constraints };
}

function shouldBypass(options = {}) {
  return Boolean(options.tenantBypass || currentTenant().bypassTenant);
}

export function tenantPlugin(schema) {
  if (schema.options.tenantScoped === false || schema.$tenantPluginApplied) return;
  schema.$tenantPluginApplied = true;

  schema.add({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    archiveReason: { type: String, trim: true, default: "" },
    retentionUntil: { type: Date, default: null, index: true },
    legalHold: { type: Boolean, default: false, index: true },
    legalHoldReason: { type: String, trim: true, default: "" }
  });
  schema.index({ organization: 1, archivedAt: 1, updatedAt: -1 });

  for (const operation of queryOperations) {
    schema.pre(operation, function tenantQueryScope() {
      const options = this.getOptions?.() || {};
      if (shouldBypass(options)) return;
      const organizationId = currentOrganizationId();
      if (!organizationId) throw new Error("Organisation context is required for this operation");
      this.setQuery(scopedFilter(this.getFilter(), organizationId, options.withArchived));
      if (["updateMany", "updateOne", "findOneAndUpdate", "findOneAndReplace", "replaceOne"].includes(operation)) {
        const update = this.getUpdate?.();
        if (update && !update.organization && !update.$set?.organization) {
          this.setUpdate({ ...update, $setOnInsert: { ...(update.$setOnInsert || {}), organization: organizationId } });
        }
      }
    });
  }

  schema.pre("aggregate", function tenantAggregateScope() {
    const options = this.options || {};
    if (shouldBypass(options)) return;
    const organizationId = currentOrganizationId();
    if (!organizationId) throw new Error("Organisation context is required for this operation");
    const match = tenantMatch(organizationId);
    if (!options.withArchived) match.archivedAt = null;
    const pipeline = this.pipeline();
    const insertAt = pipeline[0]?.$geoNear ? 1 : 0;
    pipeline.splice(insertAt, 0, { $match: match });
  });

  schema.pre("validate", function tenantDocumentScope() {
    if (this.organization) return;
    const organizationId = currentOrganizationId();
    if (!organizationId) throw new Error("Organisation context is required for this record");
    this.organization = organizationId;
  });

  schema.pre("insertMany", function tenantInsertMany(next, docs) {
    if (shouldBypass()) return next();
    const organizationId = currentOrganizationId();
    if (!organizationId) return next(new Error("Organisation context is required for these records"));
    for (const doc of docs || []) doc.organization ||= organizationId;
    next();
  });

  schema.statics.findWithArchived = function findWithArchived(filter = {}) {
    return this.find(filter).setOptions({ withArchived: true });
  };

  schema.methods.archive = function archive(userId, reason = "") {
    this.archivedAt = new Date();
    this.archivedBy = userId || null;
    this.archiveReason = reason;
    this.retentionUntil ||= new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
    return this.save();
  };

  schema.methods.restore = function restore() {
    this.archivedAt = null;
    this.archivedBy = null;
    this.archiveReason = "";
    this.retentionUntil = null;
    return this.save();
  };
}

mongoose.set("applyPluginsToChildSchemas", false);
mongoose.plugin(tenantPlugin);
