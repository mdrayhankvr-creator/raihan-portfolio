import PageState from '../components/PageState'

export default function NotFound() {
  return <PageState label="404 / Page not found" title="Page not found" description="The page you're looking for isn't here. You can return to the portfolio or get in touch.">
    <a className="page-state__action" href={import.meta.env.BASE_URL}>Back to portfolio</a>
    <a className="page-state__action" href={`${import.meta.env.BASE_URL}#contact`}>Contact Raihan</a>
  </PageState>
}
