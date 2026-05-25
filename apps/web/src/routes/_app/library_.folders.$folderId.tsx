import { createFileRoute } from "@tanstack/react-router"

import { LibraryPage } from "../../pages/library-page"

export const Route = createFileRoute("/_app/library_/folders/$folderId")({
  head: () => ({
    meta: [{ title: "Folder - Sleevy" }],
  }),
  component: FolderLibraryPage,
})

function FolderLibraryPage() {
  const { folderId } = Route.useParams()
  return <LibraryPage folderId={folderId} />
}
