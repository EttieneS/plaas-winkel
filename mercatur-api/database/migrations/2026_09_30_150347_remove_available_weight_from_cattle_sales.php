<?php

use Brick\Math\BigDecimal;
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
            $table->dropColumn('available_weight_kg');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cattle_sales', function (Blueprint $table) {
            $table->decimal('available_weight_kg', 9, 3)->default(0);
        });
        DB::table('cattle_sales')->orderBy('id')->each(function (object $sale): void {
            $committed = DB::table('cattle_sale_commitments')->where('cattle_sale_id', $sale->id)
                ->where('status', 'CONFIRMED')->pluck('quantity_kg');
            $remaining = BigDecimal::of($sale->estimated_weight_kg);
            foreach ($committed as $quantity) {
                $remaining = $remaining->minus((string) $quantity);
            }
            DB::table('cattle_sales')->where('id', $sale->id)->update(['available_weight_kg' => (string) $remaining]);
        });
    }
};
