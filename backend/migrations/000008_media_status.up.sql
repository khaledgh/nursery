-- Phase 8: direct-to-R2 upload. The client now PUTs bytes straight to the
-- bucket via a presigned URL, so the Media row is created before the object
-- necessarily exists. Status tracks whether the upload was ever confirmed.
ALTER TABLE media ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ready' AFTER uploaded_by;
