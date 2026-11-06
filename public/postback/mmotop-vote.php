<?php
/**
 * MMOTOP — vote reward receiver (example)
 * MMOTOP — приёмник награды за голос (пример)
 *
 * Put this file on your server's website, e.g. https://your-server.com/mmotop-vote.php,
 * fill in the settings below, and enter its address in your MMOTOP account:
 * Edit → Reward for voting → Notification address. Then press
 * "Send a test notification": the log should show 200.
 *
 * Положите файл на сайт сервера, например https://ваш-сервер.ru/mmotop-vote.php,
 * заполните настройки ниже и впишите его адрес в кабинете MMOTOP:
 * «Изменить» → «Награда за голос» → «Адрес для уведомлений». Затем нажмите
 * «Отправить тестовое уведомление» — в журнале должно появиться 200.
 *
 * What it does / Что делает:
 *  - checks the signature (X-MMOTOP-Signature) with your secret key;
 *    проверяет подпись секретным ключом — чужой запрос не пройдёт;
 *  - gives one reward per vote: MMOTOP may send a vote again if your
 *    server did not answer, and the repeat is recognised by vote_id;
 *    одна награда на голос — повтор того же vote_id не даст вторую;
 *  - answers a test (nickname TEST) with 200 after checking the database,
 *    without giving anything;
 *    на проверку отвечает 200, проверив базу, ничего не выдавая;
 *  - answers 404 if there is no such character (MMOTOP does not retry 4xx).
 *    нет такого персонажа — 404 (такое MMOTOP не повторяет).
 *
 * PHP 7.2+ with PDO (pdo_mysql). Check the table and column names against
 * your server pack before switching the reward on.
 * Сверьте названия таблиц и колонок со своей сборкой, прежде чем включать награду.
 */

// ── Settings / Настройки ───────────────────────────────────────────────────

// The secret key from your MMOTOP account. / Секретный ключ из кабинета MMOTOP.
const MMOTOP_SECRET = 'paste-your-secret-key-here';

// The game server's database. / База игрового сервера.
const DB_DSN  = 'mysql:host=127.0.0.1;dbname=l2jdb;charset=utf8mb4';
const DB_USER = 'root';
const DB_PASS = '';

// Where characters are. / Где персонажи.
// L2J (Mobius, L2JServer…): characters / charId / char_name
// aCis, L2JFrozen and other Interlude packs: characters / obj_Id / char_name
const CHAR_TABLE = 'characters';
const CHAR_ID    = 'charId';
const CHAR_NAME  = 'char_name';

// The reward. / Награда.
const REWARD_ITEM_ID = 4037; // e.g. Coin of Luck / например, Coin of Luck
const REWARD_COUNT   = 1;

// How the reward reaches the player. / Как награда доходит до игрока.
//  'premium_items' — L2J Mobius and other packs with the premium item
//                    window (character_premium_items): the item waits there.
//                    Сборки с окном премиум-предметов: предмет ждёт там.
//  'queue'         — any pack: a row in the mmotop_rewards table, which your
//                    server (a script, a task, a GM) hands out and marks
//                    delivered = 1.
//                    Любая сборка: строка в таблице mmotop_rewards, выдачу
//                    делает ваш сервер и ставит delivered = 1.
const REWARD_MODE = 'queue';

// ── Nothing to change below / Ниже ничего менять не нужно ──────────────────

function answer(int $status, string $text): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $text;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') answer(405, 'POST only');

$body = file_get_contents('php://input');
$vote = json_decode($body, true);
if (!is_array($vote) || !isset($vote['server_id'], $vote['nickname'], $vote['vote_id'], $vote['voted_at'])) {
    answer(400, 'bad request');
}

$signed = $vote['server_id'] . ':' . $vote['nickname'] . ':' . $vote['vote_id'] . ':' . $vote['voted_at'];
$expected = hash_hmac('sha256', $signed, MMOTOP_SECRET);
if (!hash_equals($expected, (string)($_SERVER['HTTP_X_MMOTOP_SIGNATURE'] ?? ''))) answer(401, 'bad signature');

try {
    $db = new PDO(DB_DSN, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    // Votes already rewarded, and (for 'queue') the rewards to hand out.
    $db->exec('CREATE TABLE IF NOT EXISTS mmotop_votes (
        vote_id BIGINT PRIMARY KEY,
        nickname VARCHAR(64) NOT NULL,
        rewarded_at VARCHAR(32) NOT NULL)');
    if (REWARD_MODE === 'queue') {
        $db->exec('CREATE TABLE IF NOT EXISTS mmotop_rewards (
            vote_id BIGINT PRIMARY KEY,
            char_id INT NOT NULL,
            char_name VARCHAR(64) NOT NULL,
            item_id INT NOT NULL,
            item_count BIGINT NOT NULL,
            created_at VARCHAR(32) NOT NULL,
            delivered SMALLINT NOT NULL DEFAULT 0)');
    }
} catch (Throwable $e) {
    answer(500, 'database unavailable');
}

// A test from the account page: the database is reachable, nothing is given.
if (!empty($vote['test'])) answer(200, 'test ok');

$find = $db->prepare('SELECT ' . CHAR_ID . ' FROM ' . CHAR_TABLE . ' WHERE ' . CHAR_NAME . ' = ?');
$find->execute([$vote['nickname']]);
$charId = $find->fetchColumn();
if ($charId === false) answer(404, 'no such character');

$now = gmdate('Y-m-d H:i:s');
try {
    $db->beginTransaction();
    // One reward per vote: a repeat of the same vote_id stops here.
    $db->prepare('INSERT INTO mmotop_votes (vote_id, nickname, rewarded_at) VALUES (?, ?, ?)')
        ->execute([$vote['vote_id'], $vote['nickname'], $now]);

    if (REWARD_MODE === 'premium_items') {
        $next = $db->prepare('SELECT COALESCE(MAX(itemNum), 0) + 1 FROM character_premium_items WHERE charId = ?');
        $next->execute([$charId]);
        $db->prepare('INSERT INTO character_premium_items (charId, itemNum, itemId, itemCount, itemSender) VALUES (?, ?, ?, ?, ?)')
            ->execute([$charId, $next->fetchColumn(), REWARD_ITEM_ID, REWARD_COUNT, 'MMOTOP']);
    } else {
        $db->prepare('INSERT INTO mmotop_rewards (vote_id, char_id, char_name, item_id, item_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$vote['vote_id'], $charId, $vote['nickname'], REWARD_ITEM_ID, REWARD_COUNT, $now]);
    }
    $db->commit();
} catch (PDOException $e) {
    if ($db->inTransaction()) $db->rollBack();
    // 23000: this vote was rewarded already — fine, say so.
    if ($e->getCode() === '23000') answer(200, 'already rewarded');
    answer(500, 'could not give the reward');
}

answer(200, 'ok');
