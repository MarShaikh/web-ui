import AppFrame from '../components/AppFrame'
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

const WrapInfoPlugin = function(system) {
  return {
    wrapComponents: {
      info: (Original, system) => props => {
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

export default function ApiDocPage() {
  return (
    <AppFrame loggedIn={false}>
      <SwaggerUI
        url="/openapi.json"
        defaultModelExpandDepth={2}
        plugins={[WrapInfoPlugin]}
        onComplete={system => {
          // This op doesn't work in the UI because it returns a redirect to a ZIP
          hideTryOutButton('simulations', 'getSimulationDownload')
        }}
      />
    </AppFrame>
  )
}
