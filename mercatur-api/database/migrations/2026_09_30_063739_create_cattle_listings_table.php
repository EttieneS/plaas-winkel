<?php

use App\CattleListingStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cattle_listings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('farmer_id')->constrained('users')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('carcass_weight_kg', 9, 3);
            $table->decimal('price_per_kg', 8, 2);
            $table->enum('status', array_column(CattleListingStatus::cases(), 'value'))
                ->default(CattleListingStatus::Draft->value);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['farmer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cattle_listings');
    }
};
