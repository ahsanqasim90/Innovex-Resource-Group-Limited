import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class AdminErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="workspace-load-state is-error" role="alert"><AlertTriangle size={30} /><h2>This view couldn’t be displayed</h2><p>Your navigation is still available. Reload the page to try again.</p><button className="button secondary" onClick={() => window.location.reload()}><RefreshCw size={16} />Reload page</button></section>;
  }
}
