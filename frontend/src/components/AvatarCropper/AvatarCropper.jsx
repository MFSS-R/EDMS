import { useCallback, useMemo, useState } from 'react'
import { Modal, Slider, Button, Space, Typography, message } from 'antd'
import Cropper from 'react-easy-crop'

const { Text } = Typography

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180
}

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('无法处理图片')
  }

  const rotRad = getRadianAngle(rotation)
  const sin = Math.abs(Math.sin(rotRad))
  const cos = Math.abs(Math.cos(rotRad))
  const width = image.width
  const height = image.height
  const bBoxWidth = Math.ceil(width * cos + height * sin)
  const bBoxHeight = Math.ceil(width * sin + height * cos)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.translate(-width / 2, -height / 2)
  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.putImageData(data, 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }
      resolve(blob)
    }, 'image/jpeg', 0.92)
  })
}

export default function AvatarCropper({ open, image, onCancel, onConfirm }) {
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const aspect = useMemo(() => 1, [])

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!image || !croppedAreaPixels) {
      message.warning('请先调整头像区域')
      return
    }

    setConfirmLoading(true)
    try {
      const blob = await getCroppedImg(image, croppedAreaPixels, rotation)
      if (!blob) {
        message.error('头像处理失败')
        return
      }

      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      await onConfirm(file)
    } finally {
      setConfirmLoading(false)
    }
  }, [croppedAreaPixels, image, onConfirm, rotation])

  return (
    <Modal
      open={open}
      title="调整头像"
      onCancel={onCancel}
      onOk={handleConfirm}
      confirmLoading={confirmLoading}
      width={720}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative', height: 420, background: '#111', borderRadius: 12, overflow: 'hidden' }}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div>
          <Text strong>缩放</Text>
          <Slider min={1} max={3} step={0.01} value={zoom} onChange={setZoom} />
        </div>

        <div>
          <Text strong>旋转</Text>
          <Slider min={0} max={360} step={1} value={rotation} onChange={setRotation} />
        </div>

        <Space>
          <Button onClick={() => setRotation((value) => (value + 90) % 360)}>右转 90°</Button>
          <Button onClick={() => setRotation((value) => (value + 270) % 360)}>左转 90°</Button>
          <Button onClick={() => { setZoom(1); setRotation(0); setCrop({ x: 0, y: 0 }) }}>重置</Button>
        </Space>
      </div>
    </Modal>
  )
}
