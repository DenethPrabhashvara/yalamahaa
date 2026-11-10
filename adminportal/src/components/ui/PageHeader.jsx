import { cn } from '../../utils/format'

export function PageHeader({ eyebrow, title, description, subtitle, actions, action, className }) {
  const resolvedDesc = description || subtitle
  const resolvedActions = actions || action
  return (
    <div className={cn('page-header', className)}>
      <div className="page-header-copy">
        <div className="page-eyebrow">
          {eyebrow && <span>{eyebrow}</span>}
        </div>
        <h1>{title}</h1>
        {resolvedDesc && <p>{resolvedDesc}</p>}
      </div>
      {resolvedActions && <div className="page-header-actions">{resolvedActions}</div>}
    </div>
  )
}
