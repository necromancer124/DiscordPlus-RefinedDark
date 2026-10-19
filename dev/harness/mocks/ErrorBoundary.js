const R = window.React;
class Boundary extends R.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(error) { console.error("[harness] boundary caught", error); window.__dpErrors.push(String(error)); this.props.onError?.({ error }); }
    render() { return this.state.err ? null : this.props.children; }
}
export default { wrap: (C, o = {}) => p => R.createElement(Boundary, o, R.createElement(C, p)) };
