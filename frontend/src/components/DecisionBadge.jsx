import { Badge } from "@/components/ui/Badge"
import { decisionTone, titleCase } from "@/lib/utils"

export function DecisionBadge({ decision }) {
  return <Badge tone={decisionTone(decision)}>{titleCase(decision)}</Badge>
}

