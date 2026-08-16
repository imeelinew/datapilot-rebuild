import type { ExportUrl } from "@/types/download"
import request from "./request"

export async function downloadFile(url: ExportUrl, fileName: string) {
    const blob = await request.get(url, {
        params: {
            format: 'csv'
        },
        responseType: 'blob'
    }) as unknown as Blob

    const fileUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(fileUrl)

}