<?php
/**
 * MMOTOP — vote reward from the vote list (example)
 * MMOTOP — награда за голос по списку голосов (пример)
 *
 * The other way to reward votes: instead of MMOTOP sending each vote to your
 * site, this script fetches the new votes by itself and rewards them. Run it
 * every minute or two from cron, on the machine with the game database:
 *
 *   * * * * *  php /path/to/mmotop-votes-list.php
 *
 * Второй способ награды: вместо того чтобы MMOTOP присылал каждый голос на
 * ваш сайт, этот скрипт сам забирает новые голоса и выдаёт награду. Запускайте
 * его раз в минуту-две по расписанию (cron) там, где доступна база сервера.
 *
 * The list's address, with your key, is in your MMOTOP account:
 * Edit → Reward for voting → "Vote list". Switch the reward on there (the
 * notification address can stay empty) — players see the nickname field only
 * then.
 * Адрес списка с вашим ключом — в кабинете MMOTOP: «Изменить» → «Награда за
 * голос» → «Список голосов». Там же включите награду (адрес для уведомлений
 * можно оставить пустым) — иначе игроки не увидят поле для ника.
 *
 * One reward per vote: the last vote handled is remembered (mmotop_state), and
 * each vote_id is rewarded once (mmotop_votes), so running it twice, or two
 * copies at once, gives nothing twice.
 * Одна награда на голос: скрипт помнит последний обработанный голос и не
 * выдаёт награду за один голос дважды.
 *
 * PHP 7.2+ (CLI) with PDO (pdo_mysql). Check the table and column names
 * against your server pack. / Сверьте таблицы и колонки со своей сборкой.
 */

// ── Settings / Настройки ───────────────────────────────────────────────────

// The vote list address from your MMOTOP account, with the key.
// Адрес списка голосов из кабинета MMOTOP, вместе с ключом.
const LIST_URL = 'https://xpfgjhyuompskzxsmwrc.supabase.co/functions/v1/votes-list?server=your-server&key=paste-your-secret-key-here';

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

// How the reward reaches the player — the same as in mmotop-vote.php.
// Как награда доходит до игрока — так же, как в mmotop-vote.php.
//  'premium_items' — L2J Mobius and other packs with character_premium_items.
//  'queue'         — any pack: rows in mmotop_rewards for your server to hand out.
const REWARD_MODE = 'queue';

// ── Nothing to change below / Ниже ничего менять не нужно ──────────────────

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Run from the command line (cron), not through the website.\n");
}

$db = new PDO(DB_DSN, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE IF NOT EXISTS mmotop_state (
    name VARCHAR(32) PRIMARY KEY,
    value VARCHAR(64) NOT NULL)');
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

// The last vote handled; none the first time, then the list gives a day's votes.
$last = $db->query("SELECT value FROM mmotop_state WHERE name = 'last_vote_id'")->fetchColumn();
$url = LIST_URL . ($last !== false ? '&since=' . rawurlencode($last) : '');

$context = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]);
$body = @file_get_contents($url, false, $context);
$status = isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m) ? (int)$m[1] : 0;
if ($body === false || $status !== 200) {
    fwrite(STDERR, "MMOTOP: could not read the vote list (HTTP $status): " . trim((string)$body) . "\n");
    exit(1);
}

$find = $db->prepare('SELECT ' . CHAR_ID . ' FROM ' . CHAR_TABLE . ' WHERE ' . CHAR_NAME . ' = ?');
$given = 0;
foreach (preg_split('/\r?\n/', trim($body)) as $line) {
    if ($line === '') continue;
    $parts = explode(';', $line, 3);
    if (count($parts) !== 3) continue;
    [$voteId, $votedAt, $nickname] = $parts;

    $find->execute([$nickname]);
    $charId = $find->fetchColumn();
    $now = gmdate('Y-m-d H:i:s');
    try {
        $db->beginTransaction();
        if ($charId !== false) {
            // One reward per vote: a vote seen before stops here.
            $db->prepare('INSERT INTO mmotop_votes (vote_id, nickname, rewarded_at) VALUES (?, ?, ?)')
                ->execute([$voteId, $nickname, $now]);
            if (REWARD_MODE === 'premium_items') {
                $next = $db->prepare('SELECT COALESCE(MAX(itemNum), 0) + 1 FROM character_premium_items WHERE charId = ?');
                $next->execute([$charId]);
                $db->prepare('INSERT INTO character_premium_items (charId, itemNum, itemId, itemCount, itemSender) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$charId, $next->fetchColumn(), REWARD_ITEM_ID, REWARD_COUNT, 'MMOTOP']);
            } else {
                $db->prepare('INSERT INTO mmotop_rewards (vote_id, char_id, char_name, item_id, item_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$voteId, $charId, $nickname, REWARD_ITEM_ID, REWARD_COUNT, $now]);
            }
            $given++;
        }
        // No such character: nothing to give, but the vote is handled all the same.
        $db->prepare("DELETE FROM mmotop_state WHERE name = 'last_vote_id'")->execute();
        $db->prepare("INSERT INTO mmotop_state (name, value) VALUES ('last_vote_id', ?)")->execute([$voteId]);
        $db->commit();
    } catch (PDOException $e) {
        if ($db->inTransaction()) $db->rollBack();
        // 23000: this vote was rewarded already — move on past it.
        if ($e->getCode() !== '23000') {
            fwrite(STDERR, "MMOTOP: could not reward vote $voteId: " . $e->getMessage() . "\n");
            exit(1);
        }
        $db->prepare("DELETE FROM mmotop_state WHERE name = 'last_vote_id'")->execute();
        $db->prepare("INSERT INTO mmotop_state (name, value) VALUES ('last_vote_id', ?)")->execute([$voteId]);
    }
}

echo "MMOTOP: $given reward(s) given.\n";
