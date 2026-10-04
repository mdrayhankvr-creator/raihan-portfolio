import { Component } from 'react'
import type { ReactNode } from 'react'
import { setPageMetadata } from '../lib/metadata'
import PageState from './PageState'

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { setPageMetadata('error') }
  render() {
    if (!this.state.failed) return this.props.children
    return <PageState title="Something went wrong" description="This page couldn't load. Please reload and try again.">
      <button className="page-state__action" type="button" onClick={() => window.location.reload()}>Reload page</button>
      <a className="page-state__action" href={import.meta.env.BASE_URL}>Back to portfolio</a>
    </PageState>
  }
}
