<?php
// =================================================================
// JPB Quest Image Upload API for Xserver
// =================================================================

header('Access-Control-Allow-Origin: *'); // 本来は特定のオリジンに制限すべきですが、開発用に開放
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// 保存先ディレクトリ（このPHPファイルと同じ階層の uploads フォルダを想定）
$uploadDir = 'uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (!isset($_FILES['image'])) {
    echo json_encode(['error' => 'No image uploaded']);
    exit;
}

$file = $_FILES['image'];
$fileName = time() . '_' . basename($file['name']);
$targetFile = $uploadDir . $fileName;

// 画像ファイルかチェック
$check = getimagesize($file['tmp_name']);
if($check === false) {
    echo json_encode(['error' => 'File is not an image']);
    exit;
}

// ファイルサイズ制限 (例: 5MB)
if ($file['size'] > 5000000) {
    echo json_encode(['error' => 'File is too large (max 5MB)']);
    exit;
}

if (move_uploaded_file($file['tmp_name'], $targetFile)) {
    // 成功したらURLを返す
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $currentDir = dirname($_SERVER['PHP_SELF']);
    $publicUrl = $protocol . '://' . $host . rtrim($currentDir, '/') . '/' . $targetFile;

    echo json_encode(['url' => $publicUrl]);
} else {
    echo json_encode(['error' => 'Failed to move uploaded file']);
}
