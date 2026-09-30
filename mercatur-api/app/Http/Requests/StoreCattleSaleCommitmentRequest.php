<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreCattleSaleCommitmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('cattle.reserve') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'quantity_kg' => ['required', 'numeric', 'gt:0', 'max:999999.999', 'decimal:0,3'],
            'buyer_user_id' => ['missing'],
            'price_per_kg' => ['missing'],
            'cattle_sale_id' => ['missing'],
            'status' => ['missing'],
            'total_amount' => ['missing'],
            'available_weight_kg' => ['missing'],
            'remaining_weight_kg' => ['missing'],
            'committed_weight_kg' => ['missing'],
            'estimated_weight_kg' => ['missing'],
            'percentage_committed' => ['missing'],
        ];
    }
}
