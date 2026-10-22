export function MutationNotice({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <div aria-live="polite">
      {error && (
        <p role="alert" className="notice notice-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice notice-success">
          {message}
        </p>
      )}
    </div>
  );
}
