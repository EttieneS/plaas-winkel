<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cattle_sales', function (Blueprint $table) {
            // SQLite does not enforce varchar lengths; avoid rebuilding a referenced table there.
            if (DB::getDriverName() !== 'sqlite') {
                $table->string('status', 32)->default('OPEN')->change();
            }
            foreach (['target_reached_at', 'accepted_at', 'fulfilment_due_at', 'slaughtered_at',
                'processing_started_at', 'ready_for_fulfilment_at', 'fulfilled_at'] as $column) {
                $table->timestamp($column)->nullable();
            }
            $table->unsignedSmallInteger('sla_days')->nullable();
        });
        DB::table('cattle_sales')->where('status', 'FULLY_COMMITTED')->update(['status' => 'TARGET_REACHED']);
        Schema::table('cattle_sale_commitments', function (Blueprint $table): void {
            $table->string('fulfilment_state', 20)->default('UNFULFILLED');
            $table->timestamp('fulfilled_at')->nullable();
        });
        Schema::create('cattle_sale_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cattle_sale_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('cattle_sale_commitment_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('from_status', 32);
            $table->string('to_status', 32);
            $table->timestamp('occurred_at');
            $table->string('processor_name')->nullable();
            $table->string('batch_reference')->nullable();
            $table->text('notes')->nullable();
            $table->string('fulfilment_state', 20)->nullable();
            $table->timestamps();
            $table->index(['cattle_sale_id', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::table('cattle_sale_events')->exists()
            || DB::table('cattle_sales')->whereNotIn('status', ['OPEN', 'TARGET_REACHED'])->exists()) {
            throw new RuntimeException('Cannot roll back fulfilment while lifecycle history exists. Preserve or export that history first.');
        }
        Schema::dropIfExists('cattle_sale_events');
        Schema::table('cattle_sale_commitments', function (Blueprint $table): void {
            $table->dropColumn(['fulfilment_state', 'fulfilled_at']);
        });
        DB::table('cattle_sales')->where('status', 'TARGET_REACHED')->update(['status' => 'FULLY_COMMITTED']);
        Schema::table('cattle_sales', function (Blueprint $table) {
            $table->dropColumn(['target_reached_at', 'accepted_at', 'sla_days', 'fulfilment_due_at',
                'slaughtered_at', 'processing_started_at', 'ready_for_fulfilment_at', 'fulfilled_at']);
            if (DB::getDriverName() !== 'sqlite') {
                $table->string('status', 20)->default('OPEN')->change();
            }
        });
    }
};
