import { InterpretationError } from "./contracts";
import { parsePrivateInterpretation } from "./private-contract";
import { parseSiteInterpretation } from "./site-contract";
import type { PreparedRequest, RealInterpretation } from "./real-service";
import type { controlledAdmission } from "./snapshot";

type Metadata = ReturnType<typeof controlledAdmission>["metadata"];
type Executed = Omit<RealInterpretation, "deploymentMode"> & { deploymentMode: "local_pilot" | "site_pilot" };
/** Only restores already validated, server-owned catalog entries. No financial calculations. */
function display(prepared: PreparedRequest, result: Executed, metadata: Metadata) {
  const { request } = prepared, selected = result.output;
  if (!("selection" in request) || !("modelSelected" in selected) || result.inputIdentity !== "approved_real" ||
    result.inputTrust !== "controlled" || selected.modelOrganizationQuality !== "PASS" ||
    prepared.safe.contextId !== result.context.contextId || metadata.capturedAt !== result.context.capturedAt ||
    selected.catalogId !== request.selection.catalogId) throw new InterpretationError("invalid_output");
  const baseline = request.selection.deterministicBaseline;
  return {
    provider: result.provider, model: result.returnedModel, inputIdentity: result.inputIdentity, inputTrust: result.inputTrust, deploymentMode: result.deploymentMode,
    contextId: result.context.contextId, requestId: result.requestId, asOf: result.asOf, generatedAt: result.generatedAt, cacheHit: result.cacheHit, oldSnapshot: result.oldSnapshot,
    snapshot: metadata, context: result.context, catalogId: selected.catalogId, versions: selected.versions,
    baseline: { selectedClaimIds: baseline.selectedClaimIds, rationale: baseline.rationale, sentences: baseline.selectedClaimIds.map(id => {
      const e = request.selection.entries.find(e => e.claimId === id);
      if (!e) throw new InterpretationError("invalid_output");
      return { claimId: e.claimId, text: e.text, evidenceRefs: e.evidenceRefs, metricRefs: e.metricRefs };
    }) },
    modelSelection: { selectedClaimIds: selected.modelSelected, sentences: selected.renderedResult.summary }, systemRequired: selected.systemRequired, systemAdded: selected.systemAdded,
    selectionValidity: selected.selectionValidity, modelOrganizationQuality: selected.modelOrganizationQuality, disclosureCompleteness: selected.disclosureCompleteness,
    modelValue: "UNPROVEN", status: result.context.evidence.some(e => e.availability !== "available") ? "partial" : "success",
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, usageIdentity: result.usageIdentity,
      usageCalculatedNano: result.usageCalculatedNano, budgetChargedBoundNano: result.budgetChargedBoundNano, billedCost: null },
  };
}
export function toSiteInterpretation(prepared: PreparedRequest, result: Executed, metadata: Metadata) {
  if (result.deploymentMode !== "site_pilot") throw new InterpretationError("invalid_output");
  return parseSiteInterpretation({ format: "site-interpretation-v1", ...display(prepared, result, metadata) });
}
export function toPrivateInterpretation(prepared: PreparedRequest, result: Executed, metadata: Metadata) {
  if (result.deploymentMode !== "local_pilot") throw new InterpretationError("invalid_output");
  return parsePrivateInterpretation({ format: "private-interpretation-v1", ...display(prepared, result, metadata) });
}
