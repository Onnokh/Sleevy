import { useParams } from "@tanstack/react-router"

import { LibraryPage } from "./library-page"

export function FolderLibraryPage() {
  const { folderId } = useParams({ from: "/_app/library_/folders/$folderId" })
  return <LibraryPage folderId={folderId} />
}
