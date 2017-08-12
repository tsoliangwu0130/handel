echo "Installing CodeDeploy agent"
yum -y update
yum install -y ruby
cd /home/ec2-user
curl -O https://bucket-name.s3.amazonaws.com/latest/install
chmod +x ./install
./install auto
echo "Finished installing CodeDeploy agent"