<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cattle_sales', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 50)->unique();
            $table->foreignId('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('estimated_weight_kg', 9, 3);
            $table->decimal('price_per_kg', 8, 2);
            $table->decimal('available_weight_kg', 9, 3);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('OPEN');
            $table->timestamps();
            $table->index(['owner_user_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cattle_sales');
    }
};
