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
        Schema::create('cattle_sale_commitments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cattle_sale_id')->constrained('cattle_sales')->restrictOnDelete();
            $table->foreignId('buyer_user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('quantity_kg', 9, 3);
            $table->decimal('price_per_kg', 8, 2);
            $table->string('status', 20)->default('CONFIRMED');
            $table->timestamps();
            $table->index(['cattle_sale_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cattle_sale_commitments');
    }
};
