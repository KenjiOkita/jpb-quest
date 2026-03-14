'use client'

import { useRef, useEffect, useState } from 'react'

interface PixelAvatarProps {
    src: string
    alt: string
    className?: string
    /** ドット絵の解像度（小さいほどドットが粗い）デフォルト16 */
    pixelSize?: number
    style?: React.CSSProperties
}

/**
 * 画像をCanvasで縮小→拡大してドット絵風に変換するコンポーネント。
 * プロフィール写真や外部画像を自動的にレトロなピクセルアートに変換できます。
 */
export default function PixelAvatar({ src, alt, className = '', pixelSize = 16, style }: PixelAvatarProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        // SVG（DiceBear等）の場合はcanvas変換不要
        if (src.includes('.svg') || src.includes('dicebear')) {
            setLoaded(false)
            return
        }

        const canvas = canvasRef.current
        if (!canvas) return

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            // canvasを表示サイズに合わせる
            const displaySize = canvas.clientWidth || 80

            // 1. 一度 pixelSize x pixelSize に縮小描画
            canvas.width = pixelSize
            canvas.height = pixelSize
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(img, 0, 0, pixelSize, pixelSize)

            // 2. 実際のcanvasサイズに拡大
            const pixelData = ctx.getImageData(0, 0, pixelSize, pixelSize)
            canvas.width = displaySize
            canvas.height = displaySize
            ctx.imageSmoothingEnabled = false

            // 一時canvasで拡大
            const tmpCanvas = document.createElement('canvas')
            tmpCanvas.width = pixelSize
            tmpCanvas.height = pixelSize
            const tmpCtx = tmpCanvas.getContext('2d')!
            tmpCtx.putImageData(pixelData, 0, 0)

            ctx.drawImage(tmpCanvas, 0, 0, displaySize, displaySize)
            setLoaded(true)
        }
        img.onerror = () => {
            setLoaded(false)
        }
        img.src = src
    }, [src, pixelSize])

    // SVGの場合はそのまま<img>で表示
    if (src.includes('.svg') || src.includes('dicebear')) {
        return <img src={src} alt={alt} className={`${className}`} style={style} />
    }

    return (
        <>
            <canvas
                ref={canvasRef}
                className={`${className} ${loaded ? '' : 'hidden'}`}
                style={{ ...style, imageRendering: 'pixelated' }}
            />
            {!loaded && (
                <img src={src} alt={alt} className={`${className}`} style={style} />
            )}
        </>
    )
}
