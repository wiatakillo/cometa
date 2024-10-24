from .models import ContainerService
from rest_framework import serializers
class ContainerServiceSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    hostname = serializers.CharField(source='information.Config.Hostname', read_only=True)
    
    class Meta:
        model = ContainerService
        # fields = '__all__'
        fields = ['id', 'image', 'service_id', 'service_type', 'shared','apk_file', 'created_by','hostname', 'department_id','created_by_name' ]
        extra_kwargs = {
            'image': {'required': True},
            'service_id': {'required': False},
            'service_type': {'required': True},
            'information': {'required': False},
            'created_by': {'required': True},
            'shared': {'required': True},
            'apk_file': {'required': False},
            'department_id': {'required': True},
        }

    # def create(self, validated_data):
    #     if 'container_image' not in validated_data or not validated_data['container_image']:
    #         raise serializers.ValidationError({"container_image": "This field is required."})
    #     return super().create(validated_data)