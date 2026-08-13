import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Screen, TopBar } from '../components/ui'
import ProofGallery from '../components/ProofGallery'

/**
 * The group's photographs, on their own screen.
 *
 * Not a section on the board. The board is about today and is read top to
 * bottom once; a gallery is a place you go back to and scroll, and the two
 * want opposite things from the same column of pixels.
 */
export default function Proofs() {
  const { group, activeId } = useGroup()
  const { t } = useT()

  if (!group) return null

  return (
    <Screen>
      <TopBar title={t('proof.title')} sub={t('proof.sub')} />
      <ProofGallery groupId={activeId} />
    </Screen>
  )
}
