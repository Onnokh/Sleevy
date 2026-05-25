import { createFileRoute } from "@tanstack/react-router"

import { FolderLibraryPage } from "../../pages/folder-library-page"

export const Route = createFileRoute("/_app/library_/folders/$folderId")({
  head: () => ({
    meta: [{ title: "Folder - Sleevy" }],
  }),
  component: FolderLibraryPage,
})
