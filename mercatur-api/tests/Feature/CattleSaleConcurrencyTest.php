<?php

namespace Tests\Feature;

use App\CattleSaleStatus;
use App\Models\CattleSale;
use App\Models\CattleSaleCommitment;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class CattleSaleConcurrencyTest extends TestCase
{
    public function test_two_overlapping_mysql_reservations_cannot_take_the_same_last_ten_kg(): void
    {
        if (getenv('RUN_CATTLE_MYSQL_CONCURRENCY') !== '1') {
            $this->markTestSkipped('Set RUN_CATTLE_MYSQL_CONCURRENCY=1 with local MySQL credentials to test real row locks in an isolated database.');
        }
        $database = 'cattle_reservation_test_'.bin2hex(random_bytes(5));
        config(['database.connections.mysql.database' => null, 'database.connections.mysql.url' => null]);
        DB::purge('mysql');
        $admin = DB::connection('mysql')->getPdo();
        $admin->exec('CREATE DATABASE `'.$database.'`');
        $barrier = tempnam(sys_get_temp_dir(), 'cattle-lock-');
        unlink($barrier);
        $first = null;
        $second = null;
        try {
            config(['database.default' => 'mysql', 'database.connections.mysql.database' => $database]);
            DB::purge('mysql');
            $this->artisan('migrate', ['--force' => true])->assertExitCode(0);
            $this->seed(RbacSeeder::class);
            $buyers = User::factory()->count(2)->create();
            foreach ($buyers as $buyer) {
                $buyer->roles()->attach(Role::where('code', 'BUYER')->firstOrFail());
            }
            $sale = CattleSale::factory()->create(['estimated_weight_kg' => '250.000']);
            CattleSaleCommitment::factory()->create(['cattle_sale_id' => $sale->id, 'quantity_kg' => '240.000']);
            $worker = base_path('tests/Support/reserve-cattle-worker.php');
            $first = new Process([PHP_BINARY, $worker, $database, (string) $buyers[0]->id, (string) $sale->id, $barrier], base_path());
            $first->setTimeout(15)->start();
            $deadline = microtime(true) + 5;
            while (! file_exists($barrier) && microtime(true) < $deadline && $first->isRunning()) {
                usleep(10000);
            }
            $this->assertFileExists($barrier, $first->getErrorOutput());
            $second = new Process([PHP_BINARY, $worker, $database, (string) $buyers[1]->id, (string) $sale->id, '-'], base_path());
            $second->setTimeout(15)->start();
            $first->wait();
            $second->wait();
            $this->assertSame(0, $first->getExitCode(), $first->getErrorOutput());
            $this->assertSame(2, $second->getExitCode(), $second->getErrorOutput());
            $this->assertDatabaseCount('cattle_sale_commitments', 2);
            $updated = $sale->fresh()->load('commitments');
            $this->assertSame('250.000', $updated->committed_weight_kg);
            $this->assertSame('0.000', $updated->remaining_weight_kg);
            $this->assertSame(CattleSaleStatus::FullyCommitted, $updated->status);
        } finally {
            $first?->stop();
            $second?->stop();
            DB::disconnect('mysql');
            // Only the random database created by this test is removed.
            $admin->exec('DROP DATABASE `'.$database.'`');
            if (file_exists($barrier)) {
                unlink($barrier);
            }
        }
    }
}
