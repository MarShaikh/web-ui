import AppFrame from '../components/AppFrame'
import handleError from '../lib/handle-error'
import {ensureSession} from '../lib/session'
import {ComponentType} from 'react'
import {GetServerSideProps} from 'next'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

function hideTryOutButton(tag: string, operationId: string) {
  // The Try it Out button doesn't actually exist until the operation is expanded,
  // so we have to wait for it to be created
  const operation = document.querySelector(`#operations-${tag}-${operationId}`)
  if (operation) {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (!mutation.addedNodes) return
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i]
          if (
            node instanceof Element &&
            node.classList.contains('opblock-section')
          ) {
            const buttons = node.getElementsByClassName(
              'try-out'
            ) as HTMLCollectionOf<HTMLElement>
            for (let j = 0; j < buttons.length; j++) {
              buttons[j].style.display = 'none'
            }
          }
        }
      })
    })
    observer.observe(operation, {childList: true, subtree: true})
  }
}

const WrapInfoPlugin = function(system: any) {
  return {
    wrapComponents: {
      info: (Original: ComponentType<any>, system: any) => (props: any) => {
        return (
          <div>
            <Original {...props} />
            <div className="info markdown">
              <p>
                You can use this page to explore the API operations available in
                the Covid Modeling application. Expand an operation below, and
                you will be shown the description, parameters and response
                format of the operation. You can also execute the operation by
                selecting <strong>Try it out</strong>, completing the parameters
                and/or request body, then pressing <strong>Execute</strong>.
              </p>
              <p>
                You do not need to authenticate in order to use the operations
                through this page. However, to access the API through any other
                means (curl etc.), you will need to obtain a token. This should
                then be supplied with any further requests e.g.
              </p>
              <pre>
                <code>
                  {`curl -X 'GET' \\\n  'https://\${SERVER}/api/simulations' \\\n  -H 'accept: application/json' \\\n  -H 'Authorization: Bearer \${TOKEN}'`}
                </code>
              </pre>
              <p>
                To obtain a token, expand the <code>POST /user/token</code>{' '}
                operation below. Select <strong>Try it out</strong>, then{' '}
                <strong>Execute</strong>. The token will be displayed in the{' '}
                <strong>Server response</strong> &gt; <strong>Details</strong>{' '}
                &gt; <strong>Response body</strong> section. (Do not copy the
                entire response, only the value of the <code>token</code> key,
                which begins <code>eyJ...</code>) You <em>may</em> paste this
                token value into the window that appears when you press the{' '}
                <strong>Authorize</strong> button. Doing so will include your
                token in example requests generated by the{' '}
                <strong>Try it out</strong> function for other operations.
              </p>
            </div>
          </div>
        )
      }
    }
  }
}

// Work-around for the fact externalValues are not rendered
// https://github.com/swagger-api/swagger-ui/issues/5433
const examples = {}

const ExternalValuePlugin = function(system: any) {
  return {
    wrapComponents: {
      response: (Original: ComponentType<any>, system: any) => (props: any) => {
        const contentType = system.oas3Selectors.responseContentType(
          props.path,
          props.method
        )
        const externalValue = props.response.getIn([
          'content',
          contentType,
          'examples',
          props.activeExamplesKey,
          'externalValue'
        ])
        // Check if externalValue field exists
        if (externalValue) {
          // Check if examples map already contains externalValue key
          if (examples[externalValue]) {
            // Set example value directly from examples map
            const r = props.response.setIn(
              [
                'content',
                contentType,
                'examples',
                props.activeExamplesKey,
                'value'
              ],
              examples[externalValue]
            )
            props = {...props, response: r}
          } else {
            // Download external file
            fetch(externalValue)
              .then(res => res.text())
              .then(data => {
                // Put downloaded file content into the examples map
                examples[externalValue] = data
                // Simulate select another example action
                system.oas3Actions.setActiveExamplesMember({
                  name: 'fake',
                  pathMethod: [props.path, props.method],
                  contextType: 'responses',
                  contextName: props.code
                })
                // Reselect this example
                system.oas3Actions.setActiveExamplesMember({
                  name: props.activeExamplesKey,
                  pathMethod: [props.path, props.method],
                  contextType: 'responses',
                  contextName: props.code
                })
              })
              .catch(e => console.error(e))
          }
        }
        return system.React.createElement(Original, props)
      }
    }
  }
}

interface Props {}

export default function ApiDocPage(props: Props) {
  return (
    <AppFrame loggedIn={true}>
      <SwaggerUI
        url="/openapi.json"
        defaultModelExpandDepth={2}
        plugins={[WrapInfoPlugin, ExternalValuePlugin]}
        onComplete={system => {
          // This op doesn't work in the UI because it returns a redirect to a ZIP
          hideTryOutButton('simulations', 'getSimulationDownload')
        }}
      />
    </AppFrame>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = handleError(
  ensureSession(async (ctx, session) => {
    return {
      props: {}
    }
  })
)
