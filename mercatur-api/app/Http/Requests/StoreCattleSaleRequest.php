<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreCattleSaleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('cattle.create') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'estimated_weight_kg' => ['required', 'numeric', 'gt:0', 'max:999999.999', 'decimal:0,3'],
            'price_per_kg' => ['required', 'numeric', 'gt:0', 'max:999999.99', 'decimal:0,2'],
            'description' => ['nullable', 'string', 'max:10000'],
            'owner_user_id' => ['missing'],
            'farmer_id' => ['missing'],
            'reference' => ['missing'],
            'available_weight_kg' => ['missing'],
            'remaining_weight_kg' => ['missing'],
            'committed_weight_kg' => ['missing'],
            'percentage_committed' => ['missing'],
            'status' => ['missing'],
        ];
    }

    public function attributes(): array
    {
        return ['estimated_weight_kg' => 'estimated sellable weight', 'price_per_kg' => 'price per kg'];
    }
}
