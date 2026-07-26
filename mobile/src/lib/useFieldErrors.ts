import { useCallback, useState } from "react";
import { parseApiError } from "../api/apiError";

interface State {
  /** Server field name -> message, for rendering under the matching input. */
  fields: Record<string, string>;
  /** Whatever could not be tied to an input. Empty when fully handled. */
  message: string;
}

const EMPTY: State = { fields: {}, message: "" };

/**
 * Holds the per-field errors from a failed request.
 *
 * The API reports which field failed; without this the screen can only show one
 * message and the user has to guess which input to fix.
 */
export function useFieldErrors() {
  const [state, setState] = useState<State>(EMPTY);

  const capture = useCallback((err: unknown) => {
    const { message, fields } = parseApiError(err);
    // Keep the banner empty when every message is already shown inline, so the
    // same problem is not reported twice.
    setState({ fields, message: Object.keys(fields).length > 0 ? "" : message });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  /** Local (non-server) failures still need a way onto the screen. */
  const setMessage = useCallback((message: string) => setState({ fields: {}, message }), []);

  const fieldError = useCallback((name: string) => state.fields[name], [state.fields]);

  return { fields: state.fields, message: state.message, capture, reset, setMessage, fieldError };
}
