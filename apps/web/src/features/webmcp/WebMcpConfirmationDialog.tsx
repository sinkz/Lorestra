import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ModalDialog } from '../../shared/ui'
import type { createMergeConfirmationController } from './confirmation'

export function WebMcpConfirmationDialog({
  controller,
}: {
  controller: ReturnType<typeof createMergeConfirmationController>
}) {
  const { t } = useTranslation()
  const request = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => () => controller.cancel(), [controller])
  const cancel = () => controller.respond(request, false)

  return (
    <ModalDialog
      className="memory-dialog"
      open={Boolean(request)}
      aria-labelledby="webmcp-confirm-merge-title"
      aria-describedby="webmcp-confirm-merge-description"
      onRequestClose={cancel}
    >
      <div className="memory-dialog-card">
        <span className="eyebrow">WebMCP</span>
        <h2 id="webmcp-confirm-merge-title">{t('editor.confirmMerge')}</h2>
        <p id="webmcp-confirm-merge-description">
          {t('editor.mergeExplanation', {
            title: request?.title,
            version: request?.proposalVersion,
          })}
        </p>
        <dl className="merge-confirmation-target">
          <div>
            <dt>{t('editor.proposalId')}</dt>
            <dd>
              <code>{request?.proposalId}</code>
            </dd>
          </div>
          <div>
            <dt>{t('document.version')}</dt>
            <dd>v{request?.proposalVersion}</dd>
          </div>
          <div>
            <dt>{t('editor.contentHash')}</dt>
            <dd>
              <code>{request?.contentHash}</code>
            </dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={cancel}>
            {t('document.cancel')}
          </Button>
          <Button variant="primary" onClick={() => controller.respond(request, true)}>
            {t('editor.confirmMerge')}
          </Button>
        </div>
      </div>
    </ModalDialog>
  )
}
