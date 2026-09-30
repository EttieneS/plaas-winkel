<?php

use App\Models\User;
use App\Repositories\CattleSaleRepository;
use App\Services\CattleSaleCommitmentService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[$script, $database, $buyerId, $saleId, $barrier] = $argv;
if (! preg_match('/^cattle_reservation_test_[a-f0-9]{10}$/', $database)) {
    exit(3);
}
config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database,
    'database.connections.mysql.url' => null]);
DB::purge('mysql');

try {
    $buyer = User::findOrFail((int) $buyerId);
    if ($barrier !== '-') {
        DB::transaction(function () use ($buyer, $saleId, $barrier): void {
            app(CattleSaleRepository::class)->lock((int) $saleId);
            touch($barrier);
            // Hold the sale lock so the other process must wait before checking capacity.
            usleep(1000000);
            app(CattleSaleCommitmentService::class)->create($buyer, (int) $saleId, '10');
        });
    } else {
        app(CattleSaleCommitmentService::class)->create($buyer, (int) $saleId, '10');
    }
    exit(0);
} catch (ConflictHttpException) {
    exit(2);
}
