const RIGHTS_BASES = new Set([
  'OWNER_CREATED','OWNER_OWNED','AUTHORIZED_VENDOR','OFFICIAL_DISTRIBUTION',
  'LICENSED_CONTENT','SERVICE','OTHER'
]);
const REVIEW_STATUSES = new Set(['PENDING','APPROVED','REJECTED']);
const EXTERNAL_AUTH_BASES = new Set(['AUTHORIZED_VENDOR','OFFICIAL_DISTRIBUTION','LICENSED_CONTENT','OTHER']);

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const isHttpsUrl = (value) => {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

export function validateRightsReviewInput(input, now = new Date()) {
  const rightsBasis = clean(input?.rightsBasis, 40).toUpperCase();
  const reviewStatus = clean(input?.reviewStatus || 'PENDING', 20).toUpperCase();
  const publisherPlatform = clean(input?.publisherPlatform, 160);
  const officialTermsUrl = clean(input?.officialTermsUrl, 1000) || null;
  const authorizationEvidenceReference = clean(input?.authorizationEvidenceReference, 2000) || null;
  const chainOfTitle = clean(input?.chainOfTitle, 4000);
  const transferMethod = clean(input?.transferMethod, 2000);
  const region = clean(input?.region, 240);
  const validUntilInput = clean(input?.validUntil, 40);
  const normalizedValidUntil = /^\\d{4}-\\d{2}-\\d{2}$/.test(validUntilInput)
    ? validUntilInput + 'T23:59:59.999+07:00'
    : validUntilInput;
  const validUntil = new Date(normalizedValidUntil);
  const reviewNotes = clean(input?.reviewNotes, 4000);
  const ownerAttested = input?.ownerAttested === true;

  const errors = [];
  if (!RIGHTS_BASES.has(rightsBasis)) errors.push('INVALID_RIGHTS_BASIS');
  if (!REVIEW_STATUSES.has(reviewStatus)) errors.push('INVALID_RIGHTS_REVIEW_STATUS');
  if (publisherPlatform.length < 2) errors.push('PUBLISHER_PLATFORM_REQUIRED');
  if (chainOfTitle.length < 3) errors.push('CHAIN_OF_TITLE_REQUIRED');
  if (transferMethod.length < 3) errors.push('TRANSFER_METHOD_REQUIRED');
  if (region.length < 2) errors.push('REGION_REQUIRED');
  if (!Number.isFinite(validUntil.getTime()) || validUntil <= now) errors.push('VALID_UNTIL_MUST_BE_FUTURE');
  if (officialTermsUrl && !isHttpsUrl(officialTermsUrl)) errors.push('OFFICIAL_TERMS_URL_MUST_BE_HTTPS');

  const isInternalBasis = ['OWNER_CREATED','OWNER_OWNED','SERVICE'].includes(rightsBasis);
  if (reviewStatus === 'APPROVED') {
    if (!ownerAttested) errors.push('OWNER_ATTESTATION_REQUIRED');
    if (!isInternalBasis && !authorizationEvidenceReference) errors.push('AUTHORIZATION_EVIDENCE_REFERENCE_REQUIRED');
    if (publisherPlatform.toUpperCase() !== 'INTERNAL_OWNER' && !officialTermsUrl) errors.push('OFFICIAL_TERMS_URL_REQUIRED');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      rightsBasis, reviewStatus, publisherPlatform, officialTermsUrl,
      authorizationEvidenceReference, chainOfTitle, transferMethod, region,
      validUntil: Number.isFinite(validUntil.getTime()) ? validUntil.toISOString() : null,
      reviewNotes, ownerAttested
    }
  };
}

export function isRightsReviewUsable(review, now = new Date()) {
  if (!review || review.review_status !== 'APPROVED' || review.owner_attested !== true) return false;
  const until = new Date(review.valid_until);
  return Number.isFinite(until.getTime()) && until > now;
}

export function canAddProductInventory(product, review, now = new Date()) {
  if (!product || product.is_test === true) return false;
  if (!['DRAFT','PENDING_REVIEW','ACTIVE'].includes(product.status)) return false;
  return isRightsReviewUsable(review, now)
    && String(product.current_rights_review_id ?? '') === String(review.id ?? '');
}

export function requiredRightsEvidenceForBasis(rightsBasis) {
  return EXTERNAL_AUTH_BASES.has(String(rightsBasis ?? '').toUpperCase());
}
