CREATE OR REPLACE FUNCTION vault_core_reject_secret_question_plaintext()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_question TEXT;
BEGIN
  SELECT pertanyaan_wajib INTO v_question
  FROM vault_core_pertanyaan_wajib_only
  WHERE pertanyaan_id=NEW.question_id;

  IF v_question IS NULL THEN
    RAISE EXCEPTION 'VAULT_QUESTION_NOT_FOUND' USING ERRCODE='23503';
  END IF;

  IF v_question ~* '(login|password|\\mpass\\M|kata[[:space:]]+sandi|otp|session|recovery|token)'
     AND length(btrim(COALESCE(NEW.response_text,''))) > 0 THEN
    RAISE EXCEPTION 'VAULT_SECRET_MUST_NOT_BE_STORED_IN_QUESTION_RESPONSE'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_vc_question_response_no_plaintext
  ON vault_core_product_question_responses;

CREATE TRIGGER trg_vc_question_response_no_plaintext
BEFORE INSERT OR UPDATE OF question_id,response_text
ON vault_core_product_question_responses
FOR EACH ROW
EXECUTE FUNCTION vault_core_reject_secret_question_plaintext();