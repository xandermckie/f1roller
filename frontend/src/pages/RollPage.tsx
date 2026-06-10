import { Navigate, useSearchParams } from "react-router-dom";

export function RollPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const query = mode ? `?mode=${mode}` : "";
  return <Navigate to={`/play${query}`} replace />;
}
