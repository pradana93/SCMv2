import { base44 } from "@/api/base44Client";

export const logActivity = async (user, { action, entity_type, entity_id, entity_name, details, module }) => {
  try {
    await base44.entities.AuditLog.create({
      user_name: user?.full_name || user?.email || "Unknown",
      user_email: user?.email || "",
      action: action || "unknown",
      entity_type: entity_type || "",
      entity_id: entity_id || "",
      entity_name: entity_name || "",
      details: details || "",
      module: module || "",
    });
  } catch (e) {
    // Silent fail — audit logging must not break the main operation
  }
};